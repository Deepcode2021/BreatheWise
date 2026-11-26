// Helper utilities, schemas, and validation for BreatheWise Gemini AI Assistant
import { Type } from '@google/genai';
import type { AIResponse, DailyRoutineItem, TimeOfDay } from '@/types';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const MAX_QUESTION_LENGTH = 1500;
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_ITEM_LENGTH = 1000;
export const GEMINI_TIMEOUT_MS = 25_000;

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
  hourlySummary?: Record<string, unknown>;
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

export function getConfiguredGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_GEMINI_MODEL;
}

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
      `Estimated Indian AQI: ${context.aqi.value} (${context.aqi.category}) — ${
        context.aqi.methodology ?? context.aqi.scale
      }${context.aqi.dominantPollutant ? ` · Dominant pollutant: ${context.aqi.dominantPollutant.toUpperCase()}` : ''}`
    );
  } else if (context.aqiUnavailableReason) {
    parts.push(`Estimated AQI Status: Unavailable (${context.aqiUnavailableReason})`);
  } else {
    parts.push('Estimated AQI Status: Not available in current context.');
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
    parts.push(`24h Hourly Forecast Trend Summary: ${JSON.stringify(context.hourlySummary)}`);
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

Your role is to:
- Explain technical air-quality concepts (such as PM2.5, PM10, NO2, SO2, CO, O3, and Indian CPCB AQI categories) in simple, everyday language.
- Give practical, actionable recommendations personalized to the user's household members (adults, children, elderly, respiratory precautions), transport mode, and home setup.
- Explain clearly WHY each action is recommended.
- Support indoor air-quality improvement and sustainable, lower-emission lifestyle alternatives.

CRITICAL ACCURACY & SAFETY RULES:
1. Use ONLY the environmental context supplied in this conversation. NEVER fabricate or invent AQI numbers, pollutant concentrations, weather values, cleaner time windows, or health statistics.
2. Distinguish clearly between atmospheric model estimates/forecasts ("Estimated Indian AQI — CPCB breakpoint methodology") and official CPCB monitoring station readings. Never call an Open-Meteo model estimate an official CPCB station measurement.
3. NEVER assume morning or nighttime air is automatically cleaner. Recommend a cleaner outdoor window ONLY if the supplied hourly forecast trend shows a lower-AQI window (e.g., <=100 AQI). If no suitable outdoor window exists, recommend shifting activities indoors.
4. Follow official Indian CPCB guidance:
   - Good (0-50) & Satisfactory (51-100): generally normal outdoor activity, subject to individual comfort.
   - Moderate (101-200): reduce prolonged or strenuous outdoor exertion, especially for children, elderly, and people with respiratory or heart sensitivities.
   - Poor (201-300), Very Poor (301-400), Severe (401-500): apply progressively stronger precautions, keep vulnerable groups indoors, and move workouts indoors.
5. When environmental data is missing, incomplete, or marked as demo data, explicitly explain the limitation in "dataLimitations" and avoid pretending to know missing numbers.
6. NEVER diagnose medical conditions, prescribe treatments, or replace professional medical advice. Include an appropriate non-medical disclaimer in "disclaimer" whenever health or exposure guidance is discussed.
7. Never make unsupported claims (e.g., do not claim exact percentage reductions in personal health risk, and do not cite unverified purifier efficacy percentages; note purifier performance depends on CADR, room size, filter condition, circulation, and infiltration; never recommend ozone-generating cleaners).
8. Present any CO2 savings as estimates with transparent assumptions.
9. If generating dailyRoutine items, each item must use timeOfDay in ["morning", "commute", "outdoor-exercise", "afternoon", "evening", "night"]. For regular chat Q&A, leave dailyRoutine as an empty array [].`;

export const AI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
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
  required: [
    'summary',
    'airQualityExplanation',
    'riskLevel',
    'recommendedActions',
    'indoorSuggestions',
    'sustainableAlternatives',
    'dataLimitations',
    'disclaimer',
  ],
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

export function validateAIResponse(raw: unknown): AIResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Response payload is not an object');
  }
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  if (!summary) {
    throw new Error('Response missing non-empty summary');
  }

  return {
    summary,
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
    dataLimitations:
      typeof obj.dataLimitations === 'string' && obj.dataLimitations.trim()
        ? obj.dataLimitations.trim()
        : undefined,
    disclaimer:
      typeof obj.disclaimer === 'string' && obj.disclaimer.trim()
        ? obj.disclaimer.trim()
        : 'This guidance is informational only and does not replace professional medical advice.',
  };
}

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
