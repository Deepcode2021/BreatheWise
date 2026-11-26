// Open-Meteo Air Quality API integration (model estimates & forecasts — NOT CPCB station readings)
import type {
  AirQualityData,
  AirQualityForecast,
  ForecastDay,
  HourlyDataPoint,
  Location,
  Pollutants,
  WeatherData,
} from '@/types';
import {
  calculateCPCBAQIFromWindows,
  getCPCBCategory,
} from '@/lib/aqi';

const BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoAQResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time: string;
    european_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    carbon_monoxide?: number;
    ozone?: number;
  };
  hourly?: {
    time: string[];
    european_aqi?: Array<number | null>;
    pm2_5?: Array<number | null>;
    pm10?: Array<number | null>;
    nitrogen_dioxide?: Array<number | null>;
    sulphur_dioxide?: Array<number | null>;
    carbon_monoxide?: Array<number | null>;
    ozone?: Array<number | null>;
  };
}

interface OpenMeteoWeatherResponse {
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
  };
}

export async function fetchOpenMeteoAirQuality(
  location: Location
): Promise<{ data: AirQualityData; forecast: AirQualityForecast }> {
  const { latitude, longitude } = location.coordinates;

  // Request past_days=1 (24h lookback) + forecast_days=5 so 24h (PM2.5/PM10/NO2/SO2)
  // and 8h (CO/O3) rolling averages can be computed for CPCB methodology.
  const aqParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone',
    hourly: 'european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone',
    past_days: '1',
    forecast_days: '5',
    timezone: 'auto',
  });

  const weatherParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
    timezone: 'auto',
  });

  const [aqRes, weatherRes] = await Promise.all([
    fetch(`${BASE_URL}?${aqParams}`, { next: { revalidate: 1800 } }),
    fetch(`${WEATHER_URL}?${weatherParams}`, { next: { revalidate: 1800 } }),
  ]);

  if (!aqRes.ok) {
    throw new Error(`Open-Meteo AQ API error: ${aqRes.status}`);
  }

  const aqData: OpenMeteoAQResponse = await aqRes.json();
  const weatherData: OpenMeteoWeatherResponse = weatherRes.ok ? await weatherRes.json() : {};

  return transformOpenMeteoResponse(location, aqData, weatherData);
}

/**
 * Pure transformation function (also directly unit-testable) that converts
 * Open-Meteo API payloads into BreatheWise AirQualityData + AirQualityForecast.
 */
export function transformOpenMeteoResponse(
  location: Location,
  aqData: OpenMeteoAQResponse,
  weatherData: OpenMeteoWeatherResponse = {}
): { data: AirQualityData; forecast: AirQualityForecast } {
  const current = aqData.current;
  const weather = weatherData.current;
  const hourly = aqData.hourly;

  const instantPollutants: Pollutants = {
    pm25: current?.pm2_5 ?? null,
    pm10: current?.pm10 ?? null,
    no2: current?.nitrogen_dioxide ?? null,
    so2: current?.sulphur_dioxide ?? null,
    co: current?.carbon_monoxide ?? null,
    o3: current?.ozone ?? null,
  };

  const weatherInfo: WeatherData = {
    temperature: weather?.temperature_2m ?? null,
    humidity: weather?.relative_humidity_2m ?? null,
    windSpeed: weather?.wind_speed_10m ?? null,
    windDirection: weather?.wind_direction_10m ?? null,
    weatherCode: weather?.weather_code ?? null,
  };

  // Locate index in hourly array matching current.time (YYYY-MM-DDTHH)
  const times = hourly?.time ?? [];
  let currentIdx = -1;
  if (current?.time && times.length > 0) {
    const targetHour = current.time.slice(0, 13);
    currentIdx = times.findIndex((t) => t.slice(0, 13) === targetHour);
    if (currentIdx === -1) {
      // Fallback: last hourly entry <= current.time
      for (let i = times.length - 1; i >= 0; i--) {
        if (times[i] <= current.time) {
          currentIdx = i;
          break;
        }
      }
    }
  }
  if (currentIdx === -1 && times.length > 0) {
    currentIdx = Math.min(23, times.length - 1);
  }

  // Compute CPCB AQI from proper 24h / 8h rolling windows ending at currentIdx
  const windowAt = (idx: number) => {
    const start24 = Math.max(0, idx - 23);
    const start8 = Math.max(0, idx - 7);
    const end = idx + 1;
    return {
      pm25: hourly?.pm2_5?.slice(start24, end) ?? [],
      pm10: hourly?.pm10?.slice(start24, end) ?? [],
      no2: hourly?.nitrogen_dioxide?.slice(start24, end) ?? [],
      so2: hourly?.sulphur_dioxide?.slice(start24, end) ?? [],
      co: hourly?.carbon_monoxide?.slice(start8, end) ?? [],
      o3: hourly?.ozone?.slice(start8, end) ?? [],
    };
  };

  const cpcbResult =
    currentIdx >= 0
      ? calculateCPCBAQIFromWindows(windowAt(currentIdx), instantPollutants)
      : calculateCPCBAQIFromWindows({}, instantPollutants);

  const airQualityData: AirQualityData = {
    location,
    aqi: cpcbResult.aqi,
    pollutants: cpcbResult.averagedPollutants,
    instantPollutants,
    aqiAvailability: cpcbResult.availability,
    weather: weatherInfo,
    source: 'OpenMeteo_Model',
    sourceLabel: 'Open-Meteo Atmospheric Model (forecast/estimate — not a CPCB station)',
    timestamp: current?.time ?? new Date().toISOString(),
    isDemo: false,
    isModelEstimate: true,
  };

  // Build hourly forecast starting from currentIdx (next 48 hours)
  const hourlyPoints: HourlyDataPoint[] = [];
  if (times.length > 0 && currentIdx >= 0) {
    const endIdx = Math.min(times.length, currentIdx + 48);
    for (let i = currentIdx; i < endIdx; i++) {
      const hourCalc = calculateCPCBAQIFromWindows(windowAt(i));
      hourlyPoints.push({
        time: times[i],
        aqi: hourCalc.aqi?.value ?? null,
        pm25: hourly?.pm2_5?.[i] ?? null,
        pm10: hourly?.pm10?.[i] ?? null,
        no2: hourly?.nitrogen_dioxide?.[i] ?? null,
        o3: hourly?.ozone?.[i] ?? null,
      });
    }
  }

  // Build 5-day forecast from all forecast hours (currentIdx onwards) using CPCB categories
  const dailyMap = new Map<string, { aqis: number[]; pm25s: number[] }>();
  if (times.length > 0 && currentIdx >= 0) {
    for (let i = currentIdx; i < times.length; i++) {
      const day = times[i].split('T')[0];
      if (!dailyMap.has(day)) dailyMap.set(day, { aqis: [], pm25s: [] });
      const entry = dailyMap.get(day)!;
      const hourCalc = calculateCPCBAQIFromWindows(windowAt(i));
      if (hourCalc.aqi !== null) entry.aqis.push(hourCalc.aqi.value);
      const pm = hourly?.pm2_5?.[i];
      if (typeof pm === 'number' && Number.isFinite(pm) && pm >= 0) entry.pm25s.push(pm);
    }
  }

  const daily: ForecastDay[] = [];
  dailyMap.forEach(({ aqis, pm25s }, date) => {
    if (aqis.length === 0) return;
    const avgAqi = Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length);
    const maxAqi = Math.max(...aqis);
    const minAqi = Math.min(...aqis);
    const avgPm25 =
      pm25s.length > 0
        ? Math.round((pm25s.reduce((a, b) => a + b, 0) / pm25s.length) * 10) / 10
        : null;
    // Use CPCB category matching avgAqi (never pass CPCB values into European AQI!)
    const info = getCPCBCategory(avgAqi);
    daily.push({
      date,
      avgAqi,
      maxAqi,
      minAqi,
      avgPm25,
      category: info.category,
    });
  });

  return { data: airQualityData, forecast: { hourly: hourlyPoints, daily: daily.slice(0, 5) } };
}
