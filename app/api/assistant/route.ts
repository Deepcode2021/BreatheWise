// API route: POST /api/assistant
// Server-side Gemini integration — API key never sent to client
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, type Content } from '@google/genai';
import { fetchOpenMeteoAirQuality } from '@/lib/openMeteo';
import { summarizeHourlyTrend } from '@/lib/dailyPlan';
import {
  AI_RESPONSE_SCHEMA,
  BREATHEWISE_SYSTEM_INSTRUCTION,
  GEMINI_TIMEOUT_MS,
  MAX_QUESTION_LENGTH,
  buildContextString,
  classifyGeminiError,
  getConfiguredGeminiModel,
  sanitizeContext,
  sanitizeHistory,
  validateAIResponse,
  type AssistantContextInput,
} from '@/lib/assistant';
import type { AIResponse } from '@/types';

async function resolveAuthoritativeContext(
  clientContext: AssistantContextInput
): Promise<AssistantContextInput> {
  // If valid coordinates are supplied and we are not explicitly in demo mode,
  // derive authoritative environmental data from Open-Meteo on the server
  // rather than blindly trusting client-supplied numbers.
  const coords = clientContext.location?.coordinates;
  if (!coords || clientContext.isDemo) {
    return clientContext;
  }

  try {
    const serverFetchPromise = fetchOpenMeteoAirQuality({
      name: clientContext.location?.name ?? 'Selected Location',
      country: clientContext.location?.country ?? '',
      state: clientContext.location?.state,
      coordinates: coords,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Open-Meteo context timeout')), 5000)
    );

    const { data, forecast } = await Promise.race([serverFetchPromise, timeoutPromise]);
    const hourlySummary = summarizeHourlyTrend(forecast.hourly);

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
      hourlySummary: hourlySummary as unknown as Record<string, unknown>,
      weather: { ...data.weather },
      timestamp: data.timestamp,
      dataSource: data.sourceLabel,
      isDemo: false,
    };
  } catch {
    // Fallback cleanly to validated client context while noting server fetch fallback
    return {
      ...clientContext,
      dataSource: clientContext.dataSource
        ? `${clientContext.dataSource} (client snapshot; server re-fetch unavailable)`
        : 'Client-supplied snapshot (server environmental fetch unavailable)',
    };
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY to .env.local.' },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
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
    ? `Current Environmental & Household Context:\n${environmentalContextText}\n\nUser Question: ${rawQuestion}`
    : `Current Environmental & Household Context:\nNo environmental data was provided.\n\nUser Question: ${rawQuestion}`;

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
            temperature: 0.25,
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
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Model did not return JSON payload');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated: AIResponse = validateAIResponse(parsed);

    return NextResponse.json({
      response: validated,
      model,
    });
  } catch (error) {
    const { status, message } = classifyGeminiError(error);
    console.error(`Gemini assistant error (${status}, model=${model}):`, error instanceof Error ? error.message : 'Unknown error');

    const fallback: AIResponse = {
      summary: message,
      dataLimitations: 'Live AI analysis could not be completed for this request.',
      disclaimer: 'Please rely on the dashboard readings and official advisories while the AI service is unavailable.',
    };

    return NextResponse.json(
      { response: fallback, error: message },
      { status }
    );
  } finally {
    clearTimeout(timer);
  }
}
