import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findContiguousCleanWindows, generateDynamicDailyPlan, summarizeHourlyTrend } from '@/lib/dailyPlan';
import { ACTION_TEMPLATES, calculateTransportCO2Savings } from '@/lib/actions';
import { getCPCBCategory } from '@/lib/aqi';
import type { HourlyDataPoint, UserPreferences } from '@/types';

const BASE_PREFS: UserPreferences = {
  familyMembers: ['adults', 'children'],
  lifestyle: [],
  transportMode: 'private-car',
  hasAirPurifier: true,
};

function make24h(aqiFn: (hour: number) => number): HourlyDataPoint[] {
  return Array.from({ length: 24 }, (_, hr) => {
    const hStr = hr.toString().padStart(2, '0');
    return {
      time: `2026-11-26T${hStr}:00`,
      aqi: aqiFn(hr),
      pm25: 60,
      pm10: 120,
      no2: 40,
      o3: 40,
    };
  });
}

describe('Dynamic Daily Plan Logic', () => {
  it('never assumes morning is cleaner when morning inversion spikes above 200', () => {
    // High morning inversion (280), cleaner afternoon (90)
    const hourly = make24h((hr) => (hr >= 6 && hr < 10 ? 280 : hr >= 12 && hr < 16 ? 88 : 140));
    const plan = generateDynamicDailyPlan({
      aqi: getCPCBCategory(220),
      hourly,
      preferences: BASE_PREFS,
    });

    const morning = plan.find((i) => i.timeOfDay === 'morning')!;
    assert.ok(morning.action.toLowerCase().includes('indoors') || morning.action.toLowerCase().includes('closed'));
    assert.ok(!morning.why.toLowerCase().includes('morning air tends to be cleaner'));
  });

  it('recommends indoor workouts and does NOT invent a clean outdoor window under Severe AQI', () => {
    const hourly = make24h(() => 420);
    const plan = generateDynamicDailyPlan({
      aqi: getCPCBCategory(420),
      hourly,
      preferences: BASE_PREFS,
    });

    const exercise = plan.find((i) => i.timeOfDay === 'outdoor-exercise')!;
    assert.ok(exercise.action.toLowerCase().includes('indoors'));
    assert.ok(exercise.action.toLowerCase().includes('no suitable outdoor'));
  });

  it('handles missing/incomplete AQI safely without hallucinating numbers', () => {
    const plan = generateDynamicDailyPlan({
      aqi: null,
      hourly: [],
      preferences: BASE_PREFS,
    });

    const exercise = plan.find((i) => i.timeOfDay === 'outdoor-exercise')!;
    assert.ok(exercise.action.toLowerCase().includes('indoor'));
    assert.ok(exercise.why.toLowerCase().includes('incomplete'));
  });

  it('allows normal activity under Good AQI and detects clean windows accurately', () => {
    const hourly = make24h(() => 42);
    const trend = summarizeHourlyTrend(hourly);
    assert.equal(trend.hasGoodOrSatisfactoryWindow, true);
    assert.equal(trend.minAqi, 42);

    const plan = generateDynamicDailyPlan({
      aqi: getCPCBCategory(42),
      hourly,
      preferences: BASE_PREFS,
    });
    const exercise = plan.find((i) => i.timeOfDay === 'outdoor-exercise')!;
    assert.ok(exercise.action.includes('00:00'));
  });

  it('finds strictly contiguous chronological clean windows without merging across polluted hours', () => {
    // Clean 08:00-09:00, polluted 10:00-14:00 (220), clean 15:00-17:00
    const hourly = make24h((hr) => {
      if (hr === 8 || hr === 9) return 80;
      if (hr >= 15 && hr <= 17) return 75;
      return 220;
    });
    const windows = findContiguousCleanWindows(hourly, 100);
    assert.equal(windows.length, 2);
    assert.equal(windows[0].label, '08:00–10:00');
    assert.equal(windows[1].label, '15:00–18:00');

    const trend = summarizeHourlyTrend(hourly);
    assert.equal(trend.cleanWindowRange, '15:00–18:00');
  });
});

describe('Transparent Impact Calculations', () => {
  it('computes net transport CO2e savings after subtracting transit emissions', () => {
    // 10 km petrol car (0.18 * 10 = 1.8 kg) -> metro (0.035 * 10 = 0.35 -> 0.4 kg)
    const metroRes = calculateTransportCO2Savings({
      distanceKm: 10,
      baselineVehicle: 'petrol-car',
      baselineOccupancy: 1,
      chosenMode: 'metro',
      chosenOccupancy: 1,
    });
    assert.equal(metroRes.baselineKg, 1.8);
    assert.equal(metroRes.chosenKg, 0.4);
    assert.equal(metroRes.co2SavedKg, 1.5); // round1((0.18 - 0.035)*10) = 1.5
  });

  it('computes carpool savings proportionally to vehicle occupancy', () => {
    const res = calculateTransportCO2Savings({
      distanceKm: 10,
      baselineVehicle: 'petrol-car',
      baselineOccupancy: 1,
      chosenMode: 'carpool',
      chosenOccupancy: 2,
    });
    assert.equal(res.co2SavedKg, 0.9); // (0.18 - 0.09) * 10 = 0.9
  });

  it('returns zero savings for zero distance and does not credit immediate CO2 to tree planting', () => {
    const zeroDist = calculateTransportCO2Savings({
      distanceKm: 0,
      baselineVehicle: 'petrol-car',
      baselineOccupancy: 1,
      chosenMode: 'cycling-walking',
      chosenOccupancy: 1,
    });
    assert.equal(zeroDist.co2SavedKg, 0);

    const treeAction = ACTION_TEMPLATES.find((a) => a.action.toLowerCase().includes('tree'));
    assert.ok(treeAction);
    assert.equal(treeAction.co2Saved, 0);
    assert.equal(treeAction.isImmediateCO2, false);
  });
});

