// Open-Meteo Geocoding API
import type { Location } from '@/types';

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
}

export async function geocodeCity(query: string): Promise<Location[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error('Geocoding API error');
  const data = await res.json();
  if (!data.results || !Array.isArray(data.results)) return [];

  return data.results.map((r: GeoResult) => ({
    name: r.name,
    country: r.country,
    state: r.admin1,
    coordinates: { latitude: r.latitude, longitude: r.longitude },
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<Location> {
  // Open-Meteo doesn't have reverse geocoding; use a simple label
  return {
    name: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
    country: '',
    coordinates: { latitude: lat, longitude: lon },
  };
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

