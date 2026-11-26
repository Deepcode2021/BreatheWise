// API route: GET /api/air-quality
import { NextRequest, NextResponse } from 'next/server';
import { fetchOpenMeteoAirQuality } from '@/lib/openMeteo';
import { getDemoAirQualityData, getDemoForecast } from '@/lib/demoData';
import { sanitizeLocationLabel, validateCoordinates } from '@/lib/validation';
import type { Location } from '@/types';

/**
 * Fetches model-estimated air quality and 5-day forecast for validated coordinates
 * (or returns sample demo data when `?demo=true`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get('lat') ?? '');
  const lon = Number.parseFloat(searchParams.get('lon') ?? '');
  const name = sanitizeLocationLabel(searchParams.get('name'), 'Unknown');
  const country = sanitizeLocationLabel(searchParams.get('country'), '');
  const rawState = searchParams.get('state');
  const state = rawState ? sanitizeLocationLabel(rawState, '') || undefined : undefined;
  const demo = searchParams.get('demo') === 'true';

  if (demo) {
    return NextResponse.json({
      data: getDemoAirQualityData(),
      forecast: getDemoForecast(),
    });
  }

  const coordCheck = validateCoordinates(lat, lon);
  if (!coordCheck.valid) {
    return NextResponse.json(
      { error: coordCheck.error ?? 'Invalid coordinates' },
      { status: 400 }
    );
  }

  const location: Location = {
    name,
    country,
    state,
    coordinates: { latitude: lat, longitude: lon },
  };

  try {
    const result = await fetchOpenMeteoAirQuality(location);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Air quality fetch error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch air quality data', data: getDemoAirQualityData(), forecast: getDemoForecast() },
      { status: 503 }
    );
  }
}
