// User preferences management using localStorage
import type { UserPreferences, DailyAction } from '@/types';

const PREFS_KEY = 'breathewise_preferences';
const ACTIONS_KEY = 'breathewise_daily_actions';

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

export function loadDailyActions(): DailyAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ACTIONS_KEY);
    if (!stored) return [];
    const actions: DailyAction[] = JSON.parse(stored);
    // Only return today's actions
    const today = new Date().toISOString().split('T')[0];
    return actions.filter((a) => a.date === today);
  } catch {
    return [];
  }
}

export function saveDailyActions(actions: DailyAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const all = loadAllDailyActions().filter(
      (a) => new Date(a.date) > sevenDaysAgo
    );
    const today = new Date().toISOString().split('T')[0];
    const others = all.filter((a) => a.date !== today);
    localStorage.setItem(ACTIONS_KEY, JSON.stringify([...others, ...actions]));
  } catch {
    // ignore
  }
}

function loadAllDailyActions(): DailyAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getWeeklyProgress(): { total: number; completed: number; co2Saved: number; streak: number } {
  const all = loadAllDailyActions();
  const completed = all.filter((a) => a.completed);
  const co2Saved = completed.reduce((sum, a) => sum + a.co2Saved, 0);

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayActions = all.filter((a) => a.date === dateStr);
    if (dayActions.some((a) => a.completed)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    total: all.length,
    completed: completed.length,
    co2Saved: Math.round(co2Saved * 100) / 100,
    streak,
  };
}

