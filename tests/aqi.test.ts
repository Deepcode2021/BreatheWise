import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CO_BP,
  CPCB_METHODOLOGY_LABEL,
  NO2_BP,
  O3_BP,
  PM10_BP,
  PM25_BP,
  SO2_BP,
  calculateCPCBAQI,
  calculateCPCBAQIFromWindows,
  calculateWindowAverage,
  computeSubIndex,
  getCPCBCategory,
  getPollutantStatus,
} from '@/lib/aqi';
import { transformOpenMeteoResponse } from '@/lib/openMeteo';
import type { Location } from '@/types';

const TEST_LOCATION: Location = {
  name: 'Delhi',
  country: 'India',
  state: 'Delhi',
  coordinates: { latitude: 28.6519, longitude: 77.2315 },
};

describe('CPCB Breakpoint & Sub-Index Calculations', () => {
  it('computes exact CPCB category boundaries for PM2.5', () => {
    assert.equal(computeSubIndex(0, PM25_BP), 0);
    assert.equal(computeSubIndex(30, PM25_BP), 50);
    assert.equal(computeSubIndex(60, PM25_BP), 100);
    assert.equal(computeSubIndex(90, PM25_BP), 200);
    assert.equal(computeSubIndex(120, PM25_BP), 300);
    assert.equal(computeSubIndex(250, PM25_BP), 400);
    assert.equal(computeSubIndex(380, PM25_BP), 500);
  });

  it('handles fractional concentrations continuously without gaps', () => {
    const val = computeSubIndex(30.4, PM25_BP);
    assert.ok(val !== null && val >= 51 && val <= 52, `Expected 51-52, got ${val}`);

    const val2 = computeSubIndex(60.5, PM25_BP);
    assert.ok(val2 !== null && val2 >= 101 && val2 <= 103, `Expected 101-103, got ${val2}`);
  });

  it('caps extreme concentrations (>380 PM2.5) at 500 Severe rather than returning null', () => {
    assert.equal(computeSubIndex(600, PM25_BP), 500);
    assert.equal(computeSubIndex(800, PM10_BP), 500);
    assert.equal(computeSubIndex(700, NO2_BP), 500);
    assert.equal(computeSubIndex(3000, SO2_BP), 500);
    assert.equal(computeSubIndex(60, CO_BP), 500);
    assert.equal(computeSubIndex(1200, O3_BP), 500);
  });

  it('rejects negative and non-finite concentrations', () => {
    assert.equal(computeSubIndex(-1, PM25_BP), null);
    assert.equal(computeSubIndex(Number.NaN, PM25_BP), null);
    assert.equal(computeSubIndex(Number.POSITIVE_INFINITY, PM25_BP), null);
  });

  it('converts CO from µg/m³ to mg/m³ accurately in calculateCPCBAQI', () => {
    // 1000 µg/m³ = 1.0 mg/m³ -> CO sub-index 50; 2000 µg/m³ = 2.0 mg/m³ -> sub-index 100
    const res = calculateCPCBAQI({
      pm25: 15,   // sub-index 25
      pm10: 25,   // sub-index 25
      no2: 20,    // sub-index 25
      so2: null,
      co: 2000,   // 2.0 mg/m³ -> sub-index 100 (dominant!)
      o3: null,
    });
    assert.ok(res !== null);
    assert.equal(res.value, 100);
    assert.equal(res.category, 'Satisfactory');
    assert.equal(res.dominantPollutant, 'co');
  });
});

describe('CPCB Averaging & Minimum Data Availability Rules', () => {
  it('enforces >=16 valid hours for 24h windows and >=6 valid hours for 8h windows', () => {
    const fifteenHours = Array.from({ length: 15 }, () => 50);
    const sixteenHours = Array.from({ length: 16 }, () => 50);
    const fiveHours = Array.from({ length: 5 }, () => 40);
    const sixHours = Array.from({ length: 6 }, () => 40);

    assert.equal(calculateWindowAverage(fifteenHours, 24, 16).isSufficient, false);
    assert.equal(calculateWindowAverage(fifteenHours, 24, 16).average, null);

    assert.equal(calculateWindowAverage(sixteenHours, 24, 16).isSufficient, true);
    assert.equal(calculateWindowAverage(sixteenHours, 24, 16).average, 50);

    assert.equal(calculateWindowAverage(fiveHours, 8, 6).isSufficient, false);
    assert.equal(calculateWindowAverage(sixHours, 8, 6).isSufficient, true);
    assert.equal(calculateWindowAverage(sixHours, 8, 6).average, 40);
  });

  it('returns null AQI when fewer than 3 pollutants meet averaging criteria', () => {
    const res = calculateCPCBAQIFromWindows({
      pm25: Array(24).fill(80),
      pm10: Array(24).fill(140),
      no2: Array(10).fill(50), // insufficient (<16)
      so2: [],
      co: Array(4).fill(1000), // insufficient (<6)
      o3: [],
    });
    assert.equal(res.aqi, null);
    assert.equal(res.availability.isValid, false);
    assert.equal(res.availability.validPollutants.length, 2);
    assert.ok(res.availability.reason?.includes('3 required pollutants'));
  });

  it('returns null AQI when 3 gaseous pollutants are valid but neither PM2.5 nor PM10 is valid', () => {
    const res = calculateCPCBAQIFromWindows({
      pm25: Array(12).fill(75), // insufficient
      pm10: Array(8).fill(120), // insufficient
      no2: Array(24).fill(50),
      so2: Array(24).fill(30),
      co: Array(8).fill(1200),
      o3: Array(8).fill(45),
    });
    assert.equal(res.aqi, null);
    assert.equal(res.availability.isValid, false);
    assert.equal(res.availability.hasPM, false);
    assert.ok(res.availability.reason?.includes('neither PM2.5 nor PM10'));
  });

  it('uses maximum sub-index across valid averaged pollutants for Good, Moderate, Severe scenarios', () => {
    // Good scenario
    const good = calculateCPCBAQIFromWindows({
      pm25: Array(24).fill(15),  // SI = 25
      pm10: Array(24).fill(30),  // SI = 30
      no2: Array(24).fill(20),   // SI = 25
    });
    assert.equal(good.aqi?.category, 'Good');
    assert.equal(good.aqi?.value, 30);
    assert.equal(good.aqi?.dominantPollutant, 'pm10');
    assert.equal(good.aqi?.methodology, CPCB_METHODOLOGY_LABEL);

    // Moderate scenario
    const moderate = calculateCPCBAQIFromWindows({
      pm25: Array(24).fill(75),  // SI = 151
      pm10: Array(24).fill(150), // SI = 134
      o3: Array(8).fill(50),     // SI = 50
    });
    assert.equal(moderate.aqi?.category, 'Moderate');
    assert.equal(moderate.aqi?.value, 151);
    assert.equal(moderate.aqi?.dominantPollutant, 'pm25');

    // Severe scenario
    const severe = calculateCPCBAQIFromWindows({
      pm25: Array(24).fill(315), // SI = 451
      pm10: Array(24).fill(450), // SI = 426
      no2: Array(24).fill(90),   // SI = 111
    });
    assert.equal(severe.aqi?.category, 'Severe');
    assert.equal(severe.aqi?.value, 451);
    assert.equal(severe.aqi?.dominantPollutant, 'pm25');
  });
});

describe('Open-Meteo Payload Transformation', () => {
  it('transforms 48h+ hourly series into accurate CPCB AQI, 5-day categories, and non-official attribution', () => {
    const start = new Date('2026-11-26T00:00:00Z');
    const times: string[] = [];
    for (let i = 0; i < 72; i++) {
      const d = new Date(start.getTime() + i * 3600_000);
      times.push(d.toISOString().slice(0, 16));
    }

    const result = transformOpenMeteoResponse(
      TEST_LOCATION,
      {
        latitude: 28.65,
        longitude: 77.23,
        timezone: 'Asia/Kolkata',
        current: {
          time: times[24],
          pm2_5: 75,
          pm10: 150,
          nitrogen_dioxide: 60,
          sulphur_dioxide: 20,
          carbon_monoxide: 1200,
          ozone: 45,
        },
        hourly: {
          time: times,
          pm2_5: Array(72).fill(75),
          pm10: Array(72).fill(150),
          nitrogen_dioxide: Array(72).fill(60),
          sulphur_dioxide: Array(72).fill(20),
          carbon_monoxide: Array(72).fill(1200),
          ozone: Array(72).fill(45),
        },
      },
      {
        current: {
          time: times[24],
          temperature_2m: 20,
          relative_humidity_2m: 60,
          wind_speed_10m: 5,
          wind_direction_10m: 270,
          weather_code: 1,
        },
      }
    );

    assert.equal(result.data.isModelEstimate, true);
    assert.ok(result.data.sourceLabel.includes('not a CPCB station'));
    assert.equal(result.data.aqi?.value, 151);
    assert.equal(result.data.aqi?.category, 'Moderate');
    // Verify 5-day forecast uses CPCB category 'Moderate' (not European 'Severe' bug!)
    assert.ok(result.forecast.daily.length >= 2);
    assert.equal(result.forecast.daily[0].category, 'Moderate');
  });

  it('preserves individual instant pollutants when hourly averaging data is incomplete', () => {
    const result = transformOpenMeteoResponse(TEST_LOCATION, {
      latitude: 28.65,
      longitude: 77.23,
      timezone: 'Asia/Kolkata',
      current: {
        time: '2026-11-26T14:00',
        pm2_5: 95,
        pm10: 180,
        nitrogen_dioxide: 50,
      },
      hourly: {
        time: ['2026-11-26T12:00', '2026-11-26T13:00', '2026-11-26T14:00'], // only 3 hours
        pm2_5: [90, 92, 95],
        pm10: [170, 175, 180],
        nitrogen_dioxide: [45, 48, 50],
      },
    });

    assert.equal(result.data.aqi, null);
    assert.equal(result.data.aqiAvailability?.isValid, false);
    assert.equal(result.data.instantPollutants?.pm25, 95);
    assert.equal(result.data.instantPollutants?.pm10, 180);
  });

  it('evaluates pollutant NAAQS benchmarks correctly', () => {
    assert.equal(getPollutantStatus('pm25', 25), 'below_benchmark');
    assert.equal(getPollutantStatus('pm25', 45), 'moderate');
    assert.equal(getPollutantStatus('pm25', 75), 'above_benchmark');
    assert.equal(getPollutantStatus('o3', 110), 'above_benchmark');
    assert.equal(getPollutantStatus('co', 1500), 'moderate');
    assert.equal(getCPCBCategory(420).category, 'Severe');
  });
});

