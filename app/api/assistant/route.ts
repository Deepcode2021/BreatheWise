// API route: POST /api/assistant
// Server-side Gemini integration — API key never sent to client
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, type Content } from '@google/genai';
import { fetchOpenMeteoAirQuality } from '@/lib/openMeteo';
import { summarizeHourlyTrend } from '@/lib/dailyPlan';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import {
  AI_RESPONSE_SCHEMA,
  BREATHEWISE_SYSTEM_INSTRUCTION,
  GEMINI_TIMEOUT_MS,
  MAX_QUESTION_LENGTH,
  buildContextString,
  classifyGeminiError,
  compactHourlyForecast,
  extractJsonObject,
  getConfiguredGeminiModel,
  sanitizeContext,
  sanitizeHistory,
  validateAIResponse,
  type AssistantContextInput,
} from '@/lib/assistant';
import type { AIResponse } from '@/types';

const MAX_REQUEST_BODY_BYTES = 32_768;
const OPEN_METEO_CONTEXT_TIMEOUT_MS = 5000;

async function resolveAuthoritativeContext(
  clientContext: AssistantContextInput
): Promise<AssistantContextInput> {
  // Derive authoritative environmental data from Open-Meteo on the server when coordinates are supplied
  // (unless explicitly marked as a demo/synthetic test scenario).
  const coords = clientContext.location?.coordinates;
  if (!coords || clientContext.isDemo) {
    return clientContext;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const serverFetchPromise = fetchOpenMeteoAirQuality({
      name: clientContext.location?.name ?? 'Selected Location',
      country: clientContext.location?.country ?? '',
      state: clientContext.location?.state,
      coordinates: coords,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Open-Meteo context timeout')),
        OPEN_METEO_CONTEXT_TIMEOUT_MS
      );
    });

    const { data, forecast } = await Promise.race([serverFetchPromise, timeoutPromise]);
    const hourlySummary = summarizeHourlyTrend(forecast.hourly);
    const hourlyForecast = compactHourlyForecast(forecast.hourly);

    return {
      ...clientContext,
      location: data.location,
      aqi: data.aqi
        ? {
            value: data.aqi.value,
            category: data.aqi.category,
            scale: data.aqi.scale,
            methodology: data.aqi.methodology,
            dominantPollutant: data.aqi.dominantPollutant,
          }
        : undefined,
      aqiUnavailableReason: data.aqiAvailability?.reason,
      pollutants: { ...data.pollutants },
      instantPollutants: data.instantPollutants ? { ...data.instantPollutants } : undefined,
      hourlySummary,
      hourlyForecast,
      weather: { ...data.weather },
      timestamp: data.timestamp,
      dataSource: data.sourceLabel,
      isDemo: false,
    };
  } catch {
    return {
      ...clientContext,
      dataSource: clientContext.dataSource
        ? `${clientContext.dataSource} (client snapshot; server re-fetch unavailable)`
        : 'Client-supplied snapshot (server environmental fetch unavailable)',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Generates structured environmental AI guidance via `@google/genai` using server-side credentials,
 * authoritative Open-Meteo context hydration, bounded payload validation, and sliding-window rate limiting.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY to .env.local.' },
      { status: 503 }
    );
  }

  const clientId = getClientIdentifier(request.headers);
  const limit = checkRateLimit(clientId, { windowMs: 60_000, maxRequests: 20 });
  if (!limit.allowed) {
    const rateFallback: AIResponse = {
      summary: 'Too many requests in a short window. Please wait a moment and try again.',
      dataLimitations: 'Rate limit enforced to protect server-side AI quota.',
    };
    return NextResponse.json(
      { response: rateFallback, error: 'Too many AI requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      }
    );
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredBytes = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json({ error: 'Request payload too large' }, { status: 413 });
    }
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  if (rawBodyText.length > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json({ error: 'Request payload too large' }, { status: 413 });
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';

  if (!rawQuestion) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }
  if (rawQuestion.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 }
    );
  }

  const history = sanitizeHistory(body.history);
  const sanitizedClientContext = sanitizeContext(body.context);
  const authoritativeContext = await resolveAuthoritativeContext(sanitizedClientContext);
  const environmentalContextText = buildContextString(authoritativeContext);

  const contents: Content[] = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const currentUserPrompt = environmentalContextText
    ? `Current Environmental & Household Context:\n${environmentalContextText}\n\nUser Question: ${rawQuestion}\n\nRespond specifically to this question using the supplied context. Omit sections that are not relevant to the question.`
    : `Current Environmental & Household Context:\nNo environmental data was provided.\n\nUser Question: ${rawQuestion}\n\nRespond specifically to this question and state that live environmental readings were not provided.`;

  contents.push({
    role: 'user',
    parts: [{ text: currentUserPrompt }],
  });

  const model = getConfiguredGeminiModel();
  const genai = new GoogleGenAI({ apiKey });
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS);

  try {
    let response;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await genai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: BREATHEWISE_SYSTEM_INSTRUCTION,
            temperature: 0.4,
            maxOutputTokens: 1800,
            responseMimeType: 'application/json',
            responseSchema: AI_RESPONSE_SCHEMA,
            abortSignal: abortController.signal,
          },
        });
        break;
      } catch (err) {
        lastError = err;
        const classified = classifyGeminiError(err);
        if (attempt === 0 && classified.status === 503 && !abortController.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError ?? new Error('No response from Gemini');
    }

    const rawText = response.text ?? '';
    const jsonPayload = extractJsonObject(rawText);
    const parsed: unknown = JSON.parse(jsonPayload);
    const validated: AIResponse = validateAIResponse(parsed);

    return NextResponse.json({
      response: validated,
      model,
    });
  } catch (error) {
    const { status, message } = classifyGeminiError(error);
    console.error(
      `Gemini assistant error (${status}, model=${model}):`,
      error instanceof Error ? error.message : 'Unknown error'
    );

    const fallback: AIResponse = {
      summary: message,
      dataLimitations: 'Live AI analysis could not be completed for this request.',
      disclaimer:
        'Please rely on the dashboard readings and official advisories while the AI service is unavailable.',
    };

    return NextResponse.json({ response: fallback, error: message }, { status });
  } finally {
    clearTimeout(timer);
  }
}
