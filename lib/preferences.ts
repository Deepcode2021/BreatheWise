// User preferences management using localStorage
import type { FamilyMember, UserPreferences } from '@/types';

const PREFS_KEY = 'breathewise_preferences';
const VALID_FAMILY_MEMBERS: ReadonlySet<FamilyMember> = new Set([
  'adults',
  'children',
  'elderly',
  'respiratory',
]);

export const DEFAULT_PREFERENCES: UserPreferences = {
  familyMembers: ['adults'],
  lifestyle: [],
  transportMode: 'mixed',
  hasAirPurifier: false,
};

/**
 * Loads user preferences from browser localStorage with field-level runtime validation.
 */
export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES;

    const record = parsed as Record<string, unknown>;
    const validMembers = Array.isArray(record.familyMembers)
      ? record.familyMembers.filter(
          (m): m is FamilyMember =>
            typeof m === 'string' && VALID_FAMILY_MEMBERS.has(m as FamilyMember)
        )
      : [];

    return {
      familyMembers: validMembers.length > 0 ? validMembers : DEFAULT_PREFERENCES.familyMembers,
      lifestyle: Array.isArray(record.lifestyle)
        ? record.lifestyle.filter((item): item is string => typeof item === 'string')
        : DEFAULT_PREFERENCES.lifestyle,
      transportMode:
        typeof record.transportMode === 'string' && record.transportMode.trim()
          ? record.transportMode
          : DEFAULT_PREFERENCES.transportMode,
      hasAirPurifier:
        typeof record.hasAirPurifier === 'boolean'
          ? record.hasAirPurifier
          : DEFAULT_PREFERENCES.hasAirPurifier,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Persists user preferences to browser localStorage safely.
 */
export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota/privacy mode failures
  }
}
