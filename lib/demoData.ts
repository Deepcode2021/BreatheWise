// Demo data for when live/model APIs are unavailable
import type { AirQualityData, AirQualityForecast, ForecastDay, HourlyDataPoint } from '@/types';
import { calculateCPCBAQIFromWindows, getCPCBCategory } from '@/lib/aqi';

export const DEMO_LOCATION = {
  name: 'Delhi',
  country: 'India',
  state: 'Delhi',
  coordinates: { latitude: 28.6519, longitude: 77.2315 },
};

export function getDemoAirQualityData(): AirQualityData {
  // Synthetic 24h & 8h hourly series for realistic demo calculation
  const pm25Series = Array.from({ length: 24 }, (_, i) => 70 + Math.sin(i * 0.4) * 12);
  const pm10Series = Array.from({ length: 24 }, (_, i) => 145 + Math.sin(i * 0.4) * 20);
  const no2Series = Array.from({ length: 24 }, (_, i) => 58 + Math.cos(i * 0.3) * 10);
  const so2Series = Array.from({ length: 24 }, (_, i) => 22 + Math.sin(i * 0.2) * 5);
  const coSeries = Array.from({ length: 8 }, (_, i) => 1200 + Math.cos(i * 0.5) * 150);
  const o3Series = Array.from({ length: 8 }, (_, i) => 42 + Math.sin(i * 0.5) * 10);

  const instantPollutants = {
    pm25: 73.4,
    pm10: 148.2,
    no2: 61.8,
    so2: 24.3,
    co: 1200,
    o3: 42.1,
  };

  const cpcb = calculateCPCBAQIFromWindows(
    {
      pm25: pm25Series,
      pm10: pm10Series,
      no2: no2Series,
      so2: so2Series,
      co: coSeries,
      o3: o3Series,
    },
    instantPollutants
  );

  return {
    location: DEMO_LOCATION,
    aqi: cpcb.aqi,
    pollutants: cpcb.averagedPollutants,
    instantPollutants,
    aqiAvailability: cpcb.availability,
    weather: {
      temperature: 18,
      humidity: 72,
      windSpeed: 4.2,
      windDirection: 225,
      weatherCode: 1,
    },
    source: 'Demo',
    sourceLabel: 'Demo Data (Sample Scenario) — Not real measurements',
    timestamp: new Date().toISOString(),
    isDemo: true,
    isModelEstimate: true,
  };
}

function makeHour(offset: number, base: number): HourlyDataPoint {
  const t = new Date();
  t.setHours(t.getHours() + offset, 0, 0, 0);
  const variation = Math.sin(offset * 0.3) * 25;
  const aqi = Math.max(50, Math.min(350, Math.round(base + variation)));
  return {
    time: t.toISOString(),
    aqi,
    pm25: Math.round((aqi / 2.5) * 10) / 10,
    pm10: Math.round((aqi / 1.3) * 10) / 10,
    no2: Math.round((aqi / 3.5) * 10) / 10,
    o3: Math.round(40 + Math.sin(offset * 0.5) * 15),
  };
}

export function getDemoForecast(): AirQualityForecast {
  const hourly: HourlyDataPoint[] = [];
  for (let i = 0; i < 48; i++) {
    hourly.push(makeHour(i, 165));
  }

  const rawDays = [
    { offset: 0, avgAqi: 165, maxAqi: 195, minAqi: 135, avgPm25: 73.4 },
    { offset: 1, avgAqi: 215, maxAqi: 245, minAqi: 175, avgPm25: 94.1 },
    { offset: 2, avgAqi: 155, maxAqi: 185, minAqi: 120, avgPm25: 68.7 },
    { offset: 3, avgAqi: 92, maxAqi: 118, minAqi: 72, avgPm25: 52.2 },
    { offset: 4, avgAqi: 140, maxAqi: 168, minAqi: 105, avgPm25: 65.5 },
  ];

  const daily: ForecastDay[] = rawDays.map((d) => ({
    date: getDate(d.offset),
    avgAqi: d.avgAqi,
    maxAqi: d.maxAqi,
    minAqi: d.minAqi,
    avgPm25: d.avgPm25,
    category: getCPCBCategory(d.avgAqi).category,
  }));

  return { hourly, daily };
}

function getDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
