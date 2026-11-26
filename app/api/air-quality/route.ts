// API route: GET /api/air-quality
import { NextRequest, NextResponse } from 'next/server';
import { fetchOpenMeteoAirQuality } from '@/lib/openMeteo';
import { getDemoAirQualityData, getDemoForecast } from '@/lib/demoData';
import type { Location } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');
  const name = searchParams.get('name') ?? 'Unknown';
  const country = searchParams.get('country') ?? '';
  const state = searchParams.get('state') ?? undefined;
  const demo = searchParams.get('demo') === 'true';

  if (demo) {
    return NextResponse.json({
      data: getDemoAirQualityData(),
      forecast: getDemoForecast(),
    });
  }

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
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
    console.error('Air quality fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch air quality data', data: getDemoAirQualityData(), forecast: getDemoForecast() },
      { status: 503 }
    );
  }
}

