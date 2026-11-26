// Helper utilities, schemas, and validation for BreatheWise Gemini AI Assistant
import { Type } from '@google/genai';
import type { HourlyTrendSummary } from '@/lib/dailyPlan';
import type { AIResponse, DailyRoutineItem, HourlyDataPoint, TimeOfDay } from '@/types';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const MAX_QUESTION_LENGTH = 1500;
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_ITEM_LENGTH = 1000;
export const GEMINI_TIMEOUT_MS = 25_000;

export const DEFAULT_DATA_SOURCE_DISCLAIMER =
  'Environmental figures shown use Open-Meteo atmospheric model estimates mapped via Indian CPCB breakpoint methodology and are NOT official CPCB monitoring station readings.';

export const VALID_TIME_OF_DAY: ReadonlySet<TimeOfDay> = new Set([
  'morning',
  'commute',
  'outdoor-exercise',
  'afternoon',
  'evening',
  'night',
]);

export interface AssistantLocationInput {
  name?: string;
  country?: string;
  state?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CompactHourlyForecastPoint {
  time: string;
  estAqi: number | null;
  pm25: number | null;
}

export interface AssistantContextInput {
  location?: AssistantLocationInput;
  aqi?: {
    value: number;
    category: string;
    scale: string;
    methodology?: string;
    dominantPollutant?: string;
  };
  aqiUnavailableReason?: string;
  pollutants?: Record<string, number | null>;
  instantPollutants?: Record<string, number | null>;
  hourlySummary?: HourlyTrendSummary | Record<string, unknown>;
  hourlyForecast?: CompactHourlyForecastPoint[];
  weather?: Record<string, number | null>;
  preferences?: {
    familyMembers?: string[];
    transportMode?: string;
    hasAirPurifier?: boolean;
    lifestyle?: string[];
  };
  timestamp?: string;
  dataSource?: string;
  isDemo?: boolean;
}

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Resolves the active Gemini model from `GEMINI_MODEL`, falling back to `gemini-3.5-flash-lite`.
 */
export function getConfiguredGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_GEMINI_MODEL;
}

/**
 * Compresses up to 24 hourly forecast points to minimal fields suitable for Gemini prompt context.
 */
export function compactHourlyForecast(hourly: HourlyDataPoint[]): CompactHourlyForecastPoint[] {
  return hourly.slice(0, 24).map((h) => ({
    time: h.time,
    estAqi: h.aqi,
    pm25: h.pm25 !== null && Number.isFinite(h.pm25) ? Math.round(h.pm25 * 10) / 10 : null,
  }));
}

/**
 * Bounds and sanitizes chat history turns (`user` / `assistant`) for safe Gemini multi-turn prompts.
 */
export function sanitizeHistory(raw: unknown): AssistantHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { role: string; content: string } =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as { role?: unknown }).role === 'string' &&
        typeof (item as { content?: unknown }).content === 'string'
    )
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content.trim().slice(0, MAX_HISTORY_ITEM_LENGTH),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

/**
 * Validates and clamps client-supplied environmental and household context inputs before prompting Gemini.
 */
export function sanitizeContext(raw: unknown): AssistantContextInput {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const out: AssistantContextInput = {};

  if (src.location && typeof src.location === 'object') {
    const loc = src.location as Record<string, unknown>;
    const coords = loc.coordinates as Record<string, unknown> | undefined;
    const validCoords =
      coords &&
      typeof coords.latitude === 'number' &&
      typeof coords.longitude === 'number' &&
      Number.isFinite(coords.latitude) &&
      Number.isFinite(coords.longitude) &&
      coords.latitude >= -90 &&
      coords.latitude <= 90 &&
      coords.longitude >= -180 &&
      coords.longitude <= 180
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : undefined;

    out.location = {
      name: typeof loc.name === 'string' ? loc.name.slice(0, 100) : undefined,
      country: typeof loc.country === 'string' ? loc.country.slice(0, 100) : undefined,
      state: typeof loc.state === 'string' ? loc.state.slice(0, 100) : undefined,
      coordinates: validCoords,
    };
  }

  if (src.aqi && typeof src.aqi === 'object') {
    const aqi = src.aqi as Record<string, unknown>;
    if (
      typeof aqi.value === 'number' &&
      Number.isFinite(aqi.value) &&
      aqi.value >= 0 &&
      aqi.value <= 500 &&
      typeof aqi.category === 'string'
    ) {
      out.aqi = {
        value: Math.round(aqi.value),
        category: aqi.category.slice(0, 40),
        scale: typeof aqi.scale === 'string' ? aqi.scale.slice(0, 60) : 'India_CPCB',
        methodology: typeof aqi.methodology === 'string' ? aqi.methodology.slice(0, 120) : undefined,
        dominantPollutant:
          typeof aqi.dominantPollutant === 'string' ? aqi.dominantPollutant.slice(0, 20) : undefined,
      };
    }
  }

  if (typeof src.aqiUnavailableReason === 'string') {
    out.aqiUnavailableReason = src.aqiUnavailableReason.slice(0, 300);
  }

  const cleanNumericMap = (input: unknown, maxVal: number): Record<string, number | null> | undefined => {
    if (!input || typeof input !== 'object') return undefined;
    const result: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === null) result[k] = null;
      else if (typeof v === 'number' && Number.isFinite(v) && v >= -100 && v <= maxVal) {
        result[k] = Math.round(v * 10) / 10;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };

  out.pollutants = cleanNumericMap(src.pollutants, 200_000);
  out.instantPollutants = cleanNumericMap(src.instantPollutants, 200_000);
  out.weather = cleanNumericMap(src.weather, 1000);

  if (src.hourlySummary && typeof src.hourlySummary === 'object') {
    out.hourlySummary = src.hourlySummary as Record<string, unknown>;
  }

  if (Array.isArray(src.hourlyForecast)) {
    const cleanedForecast: CompactHourlyForecastPoint[] = [];
    for (const pt of src.hourlyForecast.slice(0, 24)) {
      if (!pt || typeof pt !== 'object') continue;
      const p = pt as Record<string, unknown>;
      if (typeof p.time !== 'string') continue;
      cleanedForecast.push({
        time: p.time.slice(0, 30),
        estAqi: typeof p.estAqi === 'number' && Number.isFinite(p.estAqi) ? Math.round(p.estAqi) : null,
        pm25: typeof p.pm25 === 'number' && Number.isFinite(p.pm25) ? Math.round(p.pm25 * 10) / 10 : null,
      });
    }
    if (cleanedForecast.length > 0) {
      out.hourlyForecast = cleanedForecast;
    }
  }

  if (src.preferences && typeof src.preferences === 'object') {
    const p = src.preferences as Record<string, unknown>;
    out.preferences = {
      familyMembers: Array.isArray(p.familyMembers)
        ? p.familyMembers.filter((m): m is string => typeof m === 'string').slice(0, 6)
        : undefined,
      transportMode: typeof p.transportMode === 'string' ? p.transportMode.slice(0, 40) : undefined,
      hasAirPurifier: typeof p.hasAirPurifier === 'boolean' ? p.hasAirPurifier : undefined,
      lifestyle: Array.isArray(p.lifestyle)
        ? p.lifestyle.filter((l): l is string => typeof l === 'string').slice(0, 10)
        : undefined,
    };
  }

  if (typeof src.timestamp === 'string') out.timestamp = src.timestamp.slice(0, 60);
  if (typeof src.dataSource === 'string') out.dataSource = src.dataSource.slice(0, 140);
  if (typeof src.isDemo === 'boolean') out.isDemo = src.isDemo;

  return out;
}

/**
 * Formats sanitized environmental metrics, hourly forecasts, and preferences into a prompt context block.
 */
export function buildContextString(context: AssistantContextInput): string {
  const parts: string[] = [];

  if (context.location?.name) {
    parts.push(
      `Location: ${context.location.name}${context.location.state ? `, ${context.location.state}` : ''}${
        context.location.country ? `, ${context.location.country}` : ''
      }`
    );
  }

  if (context.aqi) {
    parts.push(
      `Current Estimated Indian AQI: ${context.aqi.value} (${context.aqi.category}) — ${
        context.aqi.methodology ?? context.aqi.scale
      }${context.aqi.dominantPollutant ? ` · Dominant pollutant: ${context.aqi.dominantPollutant.toUpperCase()}` : ''}`
    );
  } else if (context.aqiUnavailableReason) {
    parts.push(`Current Estimated AQI Status: Unavailable (${context.aqiUnavailableReason})`);
  } else {
    parts.push('Current Estimated AQI Status: Not available in current context.');
  }

  if (context.pollutants) {
    const pollLines = Object.entries(context.pollutants)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k.toUpperCase()}: ${v} µg/m³`)
      .join(', ');
    if (pollLines) {
      parts.push(`Averaged Pollutants (24h PM2.5/PM10/NO2/SO2, 8h CO/O3): ${pollLines}`);
    }
  }

  if (context.instantPollutants) {
    const instLines = Object.entries(context.instantPollutants)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k.toUpperCase()}: ${v} µg/m³`)
      .join(', ');
    if (instLines) {
      parts.push(`Current Hour Model Pollutants: ${instLines}`);
    }
  }

  if (context.hourlySummary) {
    parts.push(`24h Hourly Forecast Summary: ${JSON.stringify(context.hourlySummary)}`);
  }

  if (context.hourlyForecast && context.hourlyForecast.length > 0) {
    const chronoLines = context.hourlyForecast
      .map((h) => `${h.time.slice(11, 16) || h.time} (date ${h.time.slice(0, 10)}): estAQI=${h.estAqi ?? 'N/A'}, PM2.5=${h.pm25 ?? 'N/A'}`)
      .join(' | ');
    parts.push(`Chronological Next-24h Hourly Forecast Points: ${chronoLines}`);
  } else {
    parts.push('Chronological Next-24h Hourly Forecast Points: Unavailable.');
  }

  if (context.weather) {
    const w = context.weather;
    const weatherLines: string[] = [];
    if (w.temperature !== null && w.temperature !== undefined) weatherLines.push(`Temp: ${w.temperature}°C`);
    if (w.humidity !== null && w.humidity !== undefined) weatherLines.push(`Humidity: ${w.humidity}%`);
    if (w.windSpeed !== null && w.windSpeed !== undefined) weatherLines.push(`Wind: ${w.windSpeed} km/h`);
    if (weatherLines.length) parts.push(`Weather: ${weatherLines.join(', ')}`);
  }

  if (context.preferences) {
    const prefs = context.preferences;
    if (prefs.familyMembers?.length) parts.push(`Household Members: ${prefs.familyMembers.join(', ')}`);
    if (prefs.transportMode) parts.push(`Primary Transport Mode: ${prefs.transportMode}`);
    if (typeof prefs.hasAirPurifier === 'boolean') {
      parts.push(`HEPA Air Purifier at home: ${prefs.hasAirPurifier ? 'Yes' : 'No'}`);
    }
    if (prefs.lifestyle?.length) parts.push(`Lifestyle Preferences: ${prefs.lifestyle.join(', ')}`);
  }

  if (context.dataSource) {
    parts.push(`Data Source: ${context.dataSource}`);
  }

  if (context.isDemo) {
    parts.push('IMPORTANT: Context uses DEMO DATA (sample values, not real current observations). State this clearly in dataLimitations.');
  }

  if (context.timestamp) {
    parts.push(`Observation/Forecast Timestamp: ${context.timestamp}`);
  }

  return parts.join('\n');
}

export const BREATHEWISE_SYSTEM_INSTRUCTION = `You are BreatheWise AI — an environmental air-quality information assistant for families and communities in India.

CORE OBJECTIVE:
Understand the user's specific question first, then generate a genuinely tailored, concise, accurate response grounded ONLY in the supplied environmental and household context. Never repeat generic boilerplate across unrelated questions.

QUESTION-ADAPTIVE RESPONSE RULES:
- Children / Family play / School questions: Center summary, riskAssessment, and recommendedActions on children's outdoor exposure, school commute, and practical precautions for children. Leave sustainableAlternatives empty unless asked.
- Outdoor exercise / Running / Best time window questions: Compare CURRENT AQI against the CHRONOLOGICAL next-24h hourly forecast points. Recommend ONLY contiguous, chronological time windows explicitly supported by the forecast (never assuming morning is cleanest). If all forecast hours exceed Satisfactory (>100 AQI), explicitly state that no suitable outdoor exercise window exists and recommend indoor alternatives. Leave unrelated sections empty.
- Indoor air quality / Bedroom / Home questions: Prioritize ventilation timing (using the actual outdoor forecast trend), source control (no incense, smoking, dry sweeping), and HEPA purifier factors (CADR, room size, filter condition, circulation, infiltration). Do not cite unverified percentage reduction claims. Leave unrelated commute advice empty.
- Pollutant / Technical questions (e.g., "difference between PM2.5 and PM10", "biggest concern"): Directly explain the requested pollutant(s), particle size/sources, health mechanisms in plain language, and cite actual supplied concentrations. For pure educational definitions, omit unrelated action checklists, indoorTips, or sustainableAlternatives unless directly helpful.
- Transport / Sustainability questions: Focus on practical lower-emission travel choices (metro, bus, carpooling, walking/cycling when air permits) and transparent CO2e estimate assumptions in environmentalImpact.

CONSISTENT STRUCTURE (populate ONLY sections relevant to the user's question, EXCEPT summary and dataLimitations which are always required):
- summary: Direct 1-3 sentence answer specifically addressing the user's question.
- riskAssessment: Current estimated AQI value, CPCB category, and dominant pollutant (or state clearly if data is missing/incomplete). Omit for pure general definitions where local risk is not asked.
- riskLevel: "low" | "moderate" | "high" | "very high" (include when assessing current outdoor/exposure risk).
- airQualityExplanation: Plain-language explanation of current conditions vs hourly forecast (distinguish current AQI from forecast AQI) OR clear explanation of the pollution concept asked about.
- recommendedActions: Practical steps directly answering the user's question (empty array [] if purely educational).
- indoorSuggestions: ONLY populate when relevant to the question (e.g. indoor air, bedroom, or poor outdoor conditions requiring staying indoors). Leave [] otherwise.
- sustainableAlternatives: ONLY populate when relevant to transport, emissions, or lifestyle choices. Leave [] otherwise.
- environmentalImpact: ONLY populate when environmental/emission impact is relevant. Leave [] otherwise.
- dataLimitations: ALWAYS explain that Open-Meteo model estimates using CPCB breakpoint methodology are NOT official CPCB monitoring station readings, and note any missing, incomplete, forecast-unavailable, or demo data limitations.
- disclaimer: Include a clear non-medical disclaimer whenever providing health, exposure, children, elderly, or respiratory guidance; omit or leave empty for non-health conceptual questions.

SAFETY & DATA INTEGRITY:
1. NEVER invent AQI numbers, pollutant concentrations, cleaner time windows, or unverified reduction percentages.
2. NEVER assume morning or nighttime air is cleaner.
3. Ensure any cited forecast time ranges are strictly chronological and match the supplied forecast data.
4. NEVER diagnose medical conditions or promise guaranteed health outcomes.
5. If generating dailyRoutine items (only when explicitly asked for a daily routine/plan), use timeOfDay in ["morning", "commute", "outdoor-exercise", "afternoon", "evening", "night"]. Otherwise return dailyRoutine: [].`;

export const AI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    riskAssessment: { type: Type.STRING },
    airQualityExplanation: { type: Type.STRING },
    riskLevel: { type: Type.STRING },
    recommendedActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    dailyRoutine: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timeOfDay: { type: Type.STRING },
          timeLabel: { type: Type.STRING },
          icon: { type: Type.STRING },
          action: { type: Type.STRING },
          when: { type: Type.STRING },
          why: { type: Type.STRING },
          howItHelps: { type: Type.STRING },
          alternative: { type: Type.STRING },
        },
        required: ['timeOfDay', 'timeLabel', 'action', 'when', 'why', 'howItHelps', 'alternative'],
      },
    },
    indoorSuggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    sustainableAlternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    environmentalImpact: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    dataLimitations: { type: Type.STRING },
    disclaimer: { type: Type.STRING },
  },
  required: ['summary', 'dataLimitations'],
};

function toStringArray(val: unknown, maxItems = 8): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function normalizeRiskLevel(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const cleaned = val.trim().toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === 'low' || cleaned === 'moderate' || cleaned === 'high' || cleaned === 'very high') {
    return cleaned;
  }
  if (cleaned.includes('very') || cleaned.includes('severe')) return 'very high';
  if (cleaned.includes('high') || cleaned.includes('poor')) return 'high';
  if (cleaned.includes('moderate')) return 'moderate';
  if (cleaned.includes('low') || cleaned.includes('good')) return 'low';
  return undefined;
}

function sanitizeDailyRoutine(val: unknown): DailyRoutineItem[] {
  if (!Array.isArray(val)) return [];
  const items: DailyRoutineItem[] = [];
  for (const raw of val) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const timeOfDay = typeof r.timeOfDay === 'string' ? r.timeOfDay.trim() : '';
    if (!VALID_TIME_OF_DAY.has(timeOfDay as TimeOfDay)) continue;
    const action = typeof r.action === 'string' ? r.action.trim() : '';
    if (!action) continue;

    items.push({
      timeOfDay: timeOfDay as TimeOfDay,
      timeLabel: typeof r.timeLabel === 'string' && r.timeLabel.trim() ? r.timeLabel.trim() : timeOfDay,
      icon: typeof r.icon === 'string' && r.icon.trim() ? r.icon.trim() : '🌿',
      action,
      when: typeof r.when === 'string' ? r.when.trim() : '',
      why: typeof r.why === 'string' ? r.why.trim() : '',
      howItHelps: typeof r.howItHelps === 'string' ? r.howItHelps.trim() : '',
      alternative: typeof r.alternative === 'string' ? r.alternative.trim() : '',
      completed: false,
    });
  }
  return items;
}

/**
 * Validates parsed JSON returned by Gemini against the required structured `AIResponse` shape.
 */
export function validateAIResponse(raw: unknown): AIResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Response payload is not an object');
  }
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  if (!summary) {
    throw new Error('Response missing non-empty summary');
  }

  const dataLimitations =
    typeof obj.dataLimitations === 'string' && obj.dataLimitations.trim()
      ? obj.dataLimitations.trim()
      : DEFAULT_DATA_SOURCE_DISCLAIMER;

  const disclaimer =
    typeof obj.disclaimer === 'string' && obj.disclaimer.trim()
      ? obj.disclaimer.trim()
      : undefined;

  return {
    summary,
    riskAssessment:
      typeof obj.riskAssessment === 'string' && obj.riskAssessment.trim()
        ? obj.riskAssessment.trim()
        : undefined,
    airQualityExplanation:
      typeof obj.airQualityExplanation === 'string' && obj.airQualityExplanation.trim()
        ? obj.airQualityExplanation.trim()
        : undefined,
    riskLevel: normalizeRiskLevel(obj.riskLevel),
    recommendedActions: toStringArray(obj.recommendedActions),
    dailyRoutine: sanitizeDailyRoutine(obj.dailyRoutine),
    indoorSuggestions: toStringArray(obj.indoorSuggestions),
    sustainableAlternatives: toStringArray(obj.sustainableAlternatives),
    environmentalImpact: toStringArray(obj.environmentalImpact),
    dataLimitations,
    disclaimer,
  };
}

/**
 * Extracts the outermost JSON object substring in O(n) linear time without regex backtracking.
 */
export function extractJsonObject(rawText: string): string {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON payload');
  }
  return rawText.slice(start, end + 1);
}

/**
 * Maps raw SDK/network errors into safe HTTP status codes and user-facing error messages.
 */
export function classifyGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; code?: string; name?: string; message?: string } | null;
  const msg = (errObj?.message ?? '').toLowerCase();
  const status = typeof errObj?.status === 'number' ? errObj.status : undefined;

  if (errObj?.name === 'AbortError' || msg.includes('abort') || msg.includes('timed out') || msg.includes('timeout')) {
    return { status: 504, message: 'AI request timed out. Please try again.' };
  }
  if (status === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    return { status: 429, message: 'Gemini API quota or rate limit exceeded. Please wait a moment and try again.' };
  }
  if (status === 503 || msg.includes('"code":503') || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
    return { status: 503, message: 'Gemini AI model is temporarily experiencing high demand. Please try again in a moment.' };
  }
  if (status === 404 || msg.includes('not found') || msg.includes('not_found')) {
    return { status: 502, message: 'Configured Gemini model was not found or is unsupported. Check GEMINI_MODEL.' };
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('permission_denied')) {
    return { status: 503, message: 'Gemini API authentication failed. Please verify your server GEMINI_API_KEY configuration.' };
  }
  if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
    return { status: 502, message: 'Network error while contacting Gemini AI service. Please try again.' };
  }
  return { status: 500, message: 'Unable to generate an AI response right now. Please try again.' };
}
