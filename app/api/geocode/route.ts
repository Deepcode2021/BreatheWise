// API route: GET /api/geocode
import { NextRequest, NextResponse } from 'next/server';
import { geocodeCity } from '@/lib/geocoding';
import { validateGeocodeQuery } from '@/lib/validation';

/**
 * Proxies validated city search queries to the Open-Meteo Geocoding API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('q') ?? '';
  const validation = validateGeocodeQuery(rawQuery);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error ?? 'Invalid query', results: [] },
      { status: 400 }
    );
  }

  if (!validation.sanitized) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await geocodeCity(validation.sanitized);
    return NextResponse.json(
      { results },
      {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
      }
    );
  } catch (error) {
    console.error('Geocoding error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Geocoding failed', results: [] }, { status: 503 });
  }
}
