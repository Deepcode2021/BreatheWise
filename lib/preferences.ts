// User preferences management using localStorage
import type { UserPreferences } from '@/types';

const PREFS_KEY = 'breathewise_preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  familyMembers: ['adults'],
  lifestyle: [],
  transportMode: 'mixed',
  hasAirPurifier: false,
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
