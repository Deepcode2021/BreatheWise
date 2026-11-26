// Open-Meteo Geocoding API
import type { Location } from '@/types';
import { validateCoordinates, validateGeocodeQuery } from '@/lib/validation';

const GEOCODING_TIMEOUT_MS = 5000;

interface GeoResult {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  country?: unknown;
  admin1?: unknown;
}

/**
 * Maps and validates an Open-Meteo geocoding payload into sanitized Location records.
 */
export function parseGeocodeResults(payload: unknown): Location[] {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  const validLocations: Location[] = [];
  for (const item of results) {
    if (!item || typeof item !== 'object') continue;
    const r = item as GeoResult;
    if (
      typeof r.name !== 'string' ||
      typeof r.latitude !== 'number' ||
      typeof r.longitude !== 'number' ||
      !validateCoordinates(r.latitude, r.longitude).valid
    ) {
      continue;
    }

    validLocations.push({
      name: r.name,
      country: typeof r.country === 'string' ? r.country : '',
      state: typeof r.admin1 === 'string' ? r.admin1 : undefined,
      coordinates: { latitude: r.latitude, longitude: r.longitude },
    });
  }
  return validLocations;
}

/**
 * Queries the Open-Meteo Geocoding API with strict query validation and request timeout.
 */
export async function geocodeCity(query: string): Promise<Location[]> {
  const { valid, sanitized } = validateGeocodeQuery(query);
  if (!valid || !sanitized) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sanitized)}&count=5&language=en&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Geocoding API error: ${res.status}`);
    const data: unknown = await res.json();
    return parseGeocodeResults(data);
  } finally {
    clearTimeout(timer);
  }
}

export const POPULAR_CITIES: Location[] = [
  { name: 'Delhi', country: 'India', state: 'Delhi', coordinates: { latitude: 28.6519, longitude: 77.2315 } },
  { name: 'Mumbai', country: 'India', state: 'Maharashtra', coordinates: { latitude: 19.0760, longitude: 72.8777 } },
  { name: 'Bengaluru', country: 'India', state: 'Karnataka', coordinates: { latitude: 12.9716, longitude: 77.5946 } },
  { name: 'Chennai', country: 'India', state: 'Tamil Nadu', coordinates: { latitude: 13.0827, longitude: 80.2707 } },
  { name: 'Hyderabad', country: 'India', state: 'Telangana', coordinates: { latitude: 17.3850, longitude: 78.4867 } },
  { name: 'Kolkata', country: 'India', state: 'West Bengal', coordinates: { latitude: 22.5726, longitude: 88.3639 } },
  { name: 'Pune', country: 'India', state: 'Maharashtra', coordinates: { latitude: 18.5204, longitude: 73.8567 } },
  { name: 'Ahmedabad', country: 'India', state: 'Gujarat', coordinates: { latitude: 23.0225, longitude: 72.5714 } },
];
