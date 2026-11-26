import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_GEOCODE_QUERY_LENGTH,
  isValidLocationObject,
  sanitizeLocationLabel,
  validateCoordinates,
  validateGeocodeQuery,
} from '@/lib/validation';
import {
  checkRateLimit,
  getClientIdentifier,
  resetRateLimitStore,
} from '@/lib/rateLimit';
import { parseGeocodeResults } from '@/lib/geocoding';
import {
  formatRelativeTime,
  isTimestampStale,
  weatherCodeToDescription,
  windDirectionLabel,
} from '@/lib/utils';
import {
  buildWeeklyImpactData,
  calculateActionStreak,
  computeCategoryProgress,
} from '@/lib/actions';
import { generateDynamicDailyPlan } from '@/lib/dailyPlan';
import { extractJsonObject, sanitizeContext } from '@/lib/assistant';
import type { DailyAction, HourlyDataPoint } from '@/types';

describe('API Coordinate & Query Validation', () => {
  it('validates lat [-90, 90] and lon [-180, 180] and rejects invalid coordinates', () => {
    assert.equal(validateCoordinates(28.6519, 77.2315).valid, true);
    assert.equal(validateCoordinates(-90, 180).valid, true);
    assert.equal(validateCoordinates(90, -180).valid, true);

    assert.equal(validateCoordinates(90.01, 77).valid, false);
    assert.equal(validateCoordinates(-91, 77).valid, false);
    assert.equal(validateCoordinates(28, 180.5).valid, false);
    assert.equal(validateCoordinates(28, -181).valid, false);
    assert.equal(validateCoordinates(Number.NaN, 77).valid, false);
    assert.equal(validateCoordinates(28, Number.POSITIVE_INFINITY).valid, false);
  });

  it('validates geocode queries and rejects oversized or unsafe payloads', () => {
    assert.deepEqual(validateGeocodeQuery('   '), { valid: true, sanitized: '' });
    assert.deepEqual(validateGeocodeQuery('  New Delhi  '), {
      valid: true,
      sanitized: 'New Delhi',
    });

    const tooLong = 'a'.repeat(MAX_GEOCODE_QUERY_LENGTH + 1);
    assert.equal(validateGeocodeQuery(tooLong).valid, false);
    assert.equal(validateGeocodeQuery('Delhi<script>').valid, false);
    assert.equal(validateGeocodeQuery('Delhi\u0000').valid, false);
  });

  it('sanitizes location labels and validates untrusted Location objects', () => {
    assert.equal(sanitizeLocationLabel('  Mumbai  ', 'Unknown'), 'Mumbai');
    assert.equal(sanitizeLocationLabel('<bad>', 'Unknown'), 'Unknown');
    assert.equal(sanitizeLocationLabel(null, 'Fallback'), 'Fallback');

    assert.equal(
      isValidLocationObject({
        name: 'Delhi',
        country: 'India',
        coordinates: { latitude: 28.65, longitude: 77.23 },
      }),
      true
    );
    assert.equal(
      isValidLocationObject({
        name: 'Bad',
        country: 'India',
        coordinates: { latitude: 999, longitude: 77 },
      }),
      false
    );
    assert.equal(isValidLocationObject({ bad: true }), false);
  });

  it('filters malformed entries when parsing Open-Meteo geocoding payloads', () => {
    const parsed = parseGeocodeResults({
      results: [
        { name: 'Pune', country: 'India', admin1: 'Maharashtra', latitude: 18.52, longitude: 73.85 },
        { name: 'InvalidCoords', latitude: 120, longitude: 77 },
        { name: 123, latitude: 19, longitude: 72 },
        null,
      ],
    });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Pune');
    assert.equal(parsed[0].state, 'Maharashtra');
    assert.deepEqual(parseGeocodeResults(null), []);
  });
});

describe('Sliding-Window Rate Limiter & Client Identity', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('enforces maxRequests within the window and resets cleanly after expiry', () => {
    const t0 = 1_700_000_000_000;
    const first = checkRateLimit('ip-1', { windowMs: 10_000, maxRequests: 2 }, t0);
    const second = checkRateLimit('ip-1', { windowMs: 10_000, maxRequests: 2 }, t0 + 100);
    const blocked = checkRateLimit('ip-1', { windowMs: 10_000, maxRequests: 2 }, t0 + 200);

    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 1);
    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 0);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);

    const afterReset = checkRateLimit('ip-1', { windowMs: 10_000, maxRequests: 2 }, t0 + 11_000);
    assert.equal(afterReset.allowed, true);
    assert.equal(afterReset.remaining, 1);
  });

  it('bounds tracked keys to prevent unbounded memory growth', () => {
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 30; i++) {
      checkRateLimit(`client-${i}`, { windowMs: 60_000, maxRequests: 5, maxTrackedKeys: 10 }, t0 + i);
    }
    const fresh = checkRateLimit('fresh-client', { windowMs: 60_000, maxRequests: 5, maxTrackedKeys: 10 }, t0 + 50);
    assert.equal(fresh.allowed, true);
  });

  it('extracts normalized IP from forwarded headers with safe fallback', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' });
    assert.equal(getClientIdentifier(headers), '203.0.113.10');
    assert.equal(getClientIdentifier(new Headers()), 'local-client');
  });
});

describe('Utility & Impact Helpers Edge Cases', () => {
  it('enforces 120-minute staleness threshold and formats relative timestamps safely', () => {
    const now = 1_764_170_000_000;
    const freshIso = new Date(now - 60 * 60_000).toISOString();
    const boundaryIso = new Date(now - 120 * 60_000).toISOString();
    const staleIso = new Date(now - 121 * 60_000).toISOString();
    const futureIso = new Date(now + 10 * 60_000).toISOString();

    assert.equal(isTimestampStale(freshIso, 120, now), false);
    assert.equal(isTimestampStale(boundaryIso, 120, now), false);
    assert.equal(isTimestampStale(staleIso, 120, now), true);
    assert.equal(isTimestampStale('not-a-date', 120, now), false);
    assert.equal(formatRelativeTime(futureIso, now), 'just now');
    assert.equal(formatRelativeTime(freshIso, now), '1h ago');
    assert.equal(windDirectionLabel(180), 'S');
    assert.equal(weatherCodeToDescription(95), 'Thunderstorm');
    assert.equal(weatherCodeToDescription(999), 'Unknown');
  });

  it('aggregates 7-day weekly impact data, streaks, and category progress accurately', () => {
    const ref = new Date('2026-11-26T12:00:00.000Z');
    const actions: DailyAction[] = [
      { id: '1', category: 'transport', action: 'A', co2Saved: 1.3, assumption: '', completed: true, date: '2026-11-26' },
      { id: '2', category: 'transport', action: 'B', co2Saved: 0.5, assumption: '', completed: false, date: '2026-11-26' },
      { id: '3', category: 'lifestyle', action: 'C', co2Saved: 0.8, assumption: '', completed: true, date: '2026-11-25' },
      { id: '4', category: 'indoor', action: 'D', co2Saved: 0, assumption: '', completed: true, date: '2026-11-23' },
    ];

    assert.equal(calculateActionStreak(actions, 30, ref), 2);
    const weekly = buildWeeklyImpactData(actions, 7, ref);
    assert.equal(weekly.length, 7);
    assert.equal(weekly[6].actions, 1);
    assert.equal(weekly[6].co2, 1.3);
    assert.equal(weekly[5].actions, 1);
    assert.equal(weekly[3].actions, 1);

    const byCat = computeCategoryProgress(actions.slice(0, 2));
    assert.deepEqual(byCat.transport, { total: 2, completed: 1 });
  });

  it('handles empty hourly arrays gracefully in dynamic daily planning', () => {
    const plan = generateDynamicDailyPlan({
      aqi: null,
      hourly: [],
      preferences: { familyMembers: ['children'], lifestyle: [], transportMode: 'mixed', hasAirPurifier: false },
    });
    assert.equal(plan.length, 6);
    const exercise = plan.find((item) => item.timeOfDay === 'outdoor-exercise');
    assert.ok(exercise);
    assert.match(exercise.action, /indoor/i);
  });

  it('generates valid routine under all-severe hourly conditions without NaN or crashes', () => {
    const severeHours: HourlyDataPoint[] = Array.from({ length: 12 }, (_, idx) => ({
      time: `2026-11-26T${String(idx).padStart(2, '0')}:00`,
      aqi: 430,
      pm25: 290,
      pm10: 450,
      no2: 90,
      o3: 35,
    }));
    const plan = generateDynamicDailyPlan({
      aqi: {
        value: 430,
        category: 'Severe',
        scale: 'India_CPCB',
        color: '#6A0080',
        bgColor: '#F3E5F5',
        description: 'Severe',
        healthImplication: 'Serious impact',
      },
      hourly: severeHours,
      preferences: { familyMembers: ['adults'], lifestyle: [], transportMode: 'mixed', hasAirPurifier: true },
    });
    assert.equal(plan.length, 6);
    assert.ok(plan.every((item) => item.action.length > 0 && item.why.length > 0));
  });
});

describe('Security & Linear-Time Stress Tests', () => {
  it('extracts outermost JSON object and sanitizes huge inputs in linear time (no ReDoS)', () => {
    const padding = '{'.repeat(60_000) + 'a'.repeat(60_000);
    const input = `${padding}{"summary":"Safe","dataLimitations":"Estimate"}`;
    const start = performance.now();
    const extracted = extractJsonObject(input);
    const elapsedMs = performance.now() - start;

    assert.ok(extracted.startsWith('{'));
    assert.ok(elapsedMs < 50, `Expected linear-time extraction (<50ms), got ${elapsedMs}ms`);

    const hugeContextStart = performance.now();
    const sanitized = sanitizeContext({
      location: { name: 'X'.repeat(5000), coordinates: { latitude: 28.6, longitude: 77.2 } },
      dataSource: 'Source '.repeat(2000),
      pollutants: { pm25: 55.1234, invalid: Number.POSITIVE_INFINITY },
    });
    const ctxElapsedMs = performance.now() - hugeContextStart;
    assert.equal(sanitized.location?.name?.length, 100);
    assert.equal(sanitized.dataSource?.length, 140);
    assert.equal(sanitized.pollutants?.pm25, 55.1);
    assert.equal(sanitized.pollutants?.invalid, undefined);
    assert.ok(ctxElapsedMs < 50);
  });
});
