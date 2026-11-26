// Shared input and runtime shape validation helpers
import type { Location } from '@/types';

export const MAX_GEOCODE_QUERY_LENGTH = 100;
export const MAX_LABEL_LENGTH = 100;

const CONTROL_OR_UNSAFE_RE = /[\u0000-\u001F\u007F<>{}[\]\\$`~]/;

/**
 * Validates geographic latitude [-90, 90] and longitude [-180, 180] coordinates.
 */
export function validateCoordinates(
  lat: number,
  lon: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { valid: false, error: 'Coordinates must be finite numbers.' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90.' };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180.' };
  }
  return { valid: true };
}

/**
 * Sanitizes and bounds a location label (city/state/country) to safe length and characters.
 */
export function sanitizeLocationLabel(
  value: string | null | undefined,
  fallback: string,
  maxLength = MAX_LABEL_LENGTH
): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().slice(0, maxLength);
  if (!cleaned || CONTROL_OR_UNSAFE_RE.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

/**
 * Validates and normalizes a city geocoding query string.
 */
export function validateGeocodeQuery(raw: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const sanitized = raw.trim();
  if (!sanitized) {
    return { valid: true, sanitized: '' };
  }
  if (sanitized.length > MAX_GEOCODE_QUERY_LENGTH) {
    return {
      valid: false,
      sanitized: '',
      error: `Query exceeds maximum length of ${MAX_GEOCODE_QUERY_LENGTH} characters.`,
    };
  }
  if (CONTROL_OR_UNSAFE_RE.test(sanitized)) {
    return {
      valid: false,
      sanitized: '',
      error: 'Query contains unsupported characters.',
    };
  }
  return { valid: true, sanitized };
}

/**
 * Runtime type guard verifying untrusted JSON represents a valid Location object.
 */
export function isValidLocationObject(raw: unknown): raw is Location {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || !obj.name.trim()) return false;
  if (typeof obj.country !== 'string') return false;
  if (!obj.coordinates || typeof obj.coordinates !== 'object') return false;
  const coords = obj.coordinates as Record<string, unknown>;
  if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return false;
  return validateCoordinates(coords.latitude, coords.longitude).valid;
}
