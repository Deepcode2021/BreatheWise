import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GEMINI_MODEL,
  buildContextString,
  classifyGeminiError,
  getConfiguredGeminiModel,
  sanitizeContext,
  sanitizeHistory,
  validateAIResponse,
} from '@/lib/assistant';

describe('Gemini Assistant Helpers & Validation', () => {
  it('defaults model to gemini-3.5-flash-lite and respects GEMINI_MODEL env var', () => {
    const prev = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    assert.equal(getConfiguredGeminiModel(), DEFAULT_GEMINI_MODEL);
    assert.equal(getConfiguredGeminiModel(), 'gemini-3.5-flash-lite');

    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    assert.equal(getConfiguredGeminiModel(), 'gemini-2.5-flash');

    if (prev === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prev;
  });

  it('bounds and sanitizes conversation history to max 6 valid messages', () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));
    raw.push({ role: 'system', content: 'Injected role' });
    const cleaned = sanitizeHistory(raw);
    assert.equal(cleaned.length, 6);
    assert.equal(cleaned[0].content, 'Message 4');
    assert.ok(cleaned.every((m) => m.role === 'user' || m.role === 'assistant'));
  });

  it('sanitizes context and rejects invalid coordinates or out-of-range AQI', () => {
    const cleaned = sanitizeContext({
      location: {
        name: 'Delhi',
        country: 'India',
        coordinates: { latitude: 999, longitude: 77.2 },
      },
      aqi: { value: 9999, category: 'Severe', scale: 'India_CPCB' },
      pollutants: { pm25: 85.24, pm10: -500, no2: null },
      preferences: { familyMembers: ['adults', 'children'], hasAirPurifier: true },
    });

    assert.equal(cleaned.location?.coordinates, undefined);
    assert.equal(cleaned.aqi, undefined);
    assert.equal(cleaned.pollutants?.pm25, 85.2);
    assert.equal(cleaned.pollutants?.pm10, undefined);
    assert.equal(cleaned.pollutants?.no2, null);
    assert.deepEqual(cleaned.preferences?.familyMembers, ['adults', 'children']);
  });

  it('builds accurate context string including missing-data and demo warnings', () => {
    const missingCtx = buildContextString({
      location: { name: 'Mumbai', country: 'India' },
      isDemo: true,
    });
    assert.ok(missingCtx.includes('Mumbai'));
    assert.ok(missingCtx.includes('Not available'));
    assert.ok(missingCtx.includes('DEMO DATA'));
  });

  it('validates structured AI responses and rejects missing summary', () => {
    assert.throws(() => validateAIResponse({}), /summary/);

    const valid = validateAIResponse({
      summary: 'Air quality is Poor today.',
      airQualityExplanation: 'PM2.5 is the main driver.',
      riskLevel: 'HIGH',
      recommendedActions: ['Stay indoors', ''],
      indoorSuggestions: ['Run HEPA purifier'],
      sustainableAlternatives: ['Take Metro'],
      dailyRoutine: [
        {
          timeOfDay: 'morning',
          timeLabel: 'Morning',
          icon: '☀️',
          action: 'Stay indoors',
          when: '06:00–10:00',
          why: 'High PM2.5',
          howItHelps: 'Reduces inhalation',
          alternative: 'Indoor stretching',
        },
        {
          timeOfDay: 'invalid-slot',
          action: 'Should be filtered out',
        },
      ],
      dataLimitations: 'Open-Meteo model estimate.',
    });

    assert.equal(valid.riskLevel, 'high');
    assert.deepEqual(valid.recommendedActions, ['Stay indoors']);
    assert.equal(valid.dailyRoutine?.length, 1);
    assert.ok(valid.disclaimer);
  });

  it('classifies quota, unavailable, not-found, timeout, auth, and network errors with proper HTTP codes', () => {
    assert.equal(classifyGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }).status, 429);
    assert.equal(classifyGeminiError({ status: 503, message: 'UNAVAILABLE high demand' }).status, 503);
    assert.equal(classifyGeminiError({ status: 404, message: 'NOT_FOUND' }).status, 502);
    assert.equal(classifyGeminiError({ name: 'AbortError', message: 'aborted' }).status, 504);
    assert.equal(classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED' }).status, 503);
    assert.equal(classifyGeminiError(new Error('fetch failed')).status, 502);
  });
});
