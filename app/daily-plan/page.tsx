'use client';

import React, { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  Sun, Coffee, Bus, Dumbbell, ShoppingBag, BedDouble,
  CheckCircle2, Circle, Loader2, RefreshCw, Calendar, Info, AlertTriangle
} from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { generateDynamicDailyPlan, summarizeHourlyTrend } from '@/lib/dailyPlan';
import { compactHourlyForecast } from '@/lib/assistant';
import type { DailyRoutineItem, TimeOfDay } from '@/types';
import { cn } from '@/lib/utils';

const TIME_ICONS: Record<TimeOfDay, React.ElementType> = {
  morning: Sun,
  commute: Bus,
  'outdoor-exercise': Dumbbell,
  afternoon: ShoppingBag,
  evening: Coffee,
  night: BedDouble,
};

const TIME_COLORS: Record<TimeOfDay, string> = {
  morning: '#FFAB00',
  commute: '#14b8a6',
  'outdoor-exercise': '#34d399',
  afternoon: '#a78bfa',
  evening: '#fb923c',
  night: '#6366f1',
};

const PLAN_STORAGE_KEY = 'breathewise_daily_plan_completed';
const EMPTY_COMPLETED: string[] = [];
const planListeners = new Set<() => void>();
let cachedRawPlan: string | null = null;
let cachedCompleted: string[] = EMPTY_COMPLETED;

function subscribePlan(callback: () => void) {
  planListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PLAN_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    planListeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getCompletedSnapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY_COMPLETED;
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (raw !== cachedRawPlan) {
      cachedRawPlan = raw;
      if (!raw) {
        cachedCompleted = EMPTY_COMPLETED;
      } else {
        const parsed = JSON.parse(raw) as { date?: string; completed?: string[] };
        const today = new Date().toISOString().split('T')[0];
        cachedCompleted = parsed.date === today && Array.isArray(parsed.completed)
          ? parsed.completed
          : EMPTY_COMPLETED;
      }
    }
    return cachedCompleted;
  } catch {
    return EMPTY_COMPLETED;
  }
}

function getCompletedServerSnapshot(): string[] {
  return EMPTY_COMPLETED;
}

function saveCompletedList(completedIds: string[]) {
  if (typeof window === 'undefined') return;
  const today = new Date().toISOString().split('T')[0];
  const serialized = JSON.stringify({ date: today, completed: completedIds });
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, serialized);
  } catch {}
  cachedRawPlan = serialized;
  cachedCompleted = completedIds;
  planListeners.forEach((l) => l());
}

function RoutineCard({
  item,
  onToggle,
}: {
  item: DailyRoutineItem;
  onToggle: (timeOfDay: TimeOfDay) => void;
}) {
  const Icon = TIME_ICONS[item.timeOfDay] ?? Sun;
  const color = TIME_COLORS[item.timeOfDay] ?? '#14b8a6';

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-5 transition-colors duration-200',
        item.completed && 'opacity-70'
      )}
      style={{ borderColor: item.completed ? `${color}35` : `${color}20` }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Header: Time window + primary recommendation */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{ color, backgroundColor: `${color}15` }}
                >
                  {item.timeLabel}
                </span>
                <span className="text-xs text-slate-300">{item.when}</span>
              </div>
              <h2
                className={cn(
                  'text-base font-semibold text-white pt-0.5',
                  item.completed && 'line-through text-slate-400'
                )}
              >
                {item.action}
              </h2>
            </div>

            <button
              onClick={() => onToggle(item.timeOfDay)}
              className="flex-shrink-0 mt-0.5 transition-colors"
              aria-label={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
              ) : (
                <Circle className="w-5 h-5 text-slate-500 hover:text-teal-400 transition-colors" />
              )}
            </button>
          </div>

          {/* Distinct Explanation & Impact vs Alternative blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 space-y-1.5">
              <div className="font-semibold text-slate-200">Why & Impact</div>
              <p className="text-slate-300 leading-relaxed">{item.why}</p>
              <p className="text-teal-300 leading-relaxed">{item.howItHelps}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30 space-y-1">
              <div className="font-semibold text-amber-300">Alternative Action</div>
              <p className="text-slate-300 leading-relaxed">{item.alternative}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyPlanPage() {
  const { data, forecast } = useAirQuality();
  const { preferences } = usePreferences();
  const [aiRoutine, setAiRoutine] = useState<DailyRoutineItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const completedIds = useSyncExternalStore(
    subscribePlan,
    getCompletedSnapshot,
    getCompletedServerSnapshot
  );

  const hourly = useMemo(() => forecast?.hourly ?? [], [forecast?.hourly]);
  const trendSummary = useMemo(() => summarizeHourlyTrend(hourly), [hourly]);

  const baseRoutine = useMemo(() => {
    if (aiRoutine && aiRoutine.length > 0) return aiRoutine;
    if (!data) return [];
    return generateDynamicDailyPlan({
      aqi: data.aqi,
      pollutants: data.pollutants,
      hourly,
      preferences,
    });
  }, [aiRoutine, data, hourly, preferences]);

  const routine = useMemo(() => {
    const set = new Set(completedIds);
    return baseRoutine.map((item) => ({
      ...item,
      completed: set.has(item.timeOfDay),
    }));
  }, [baseRoutine, completedIds]);

  const generatePlanWithAI = useCallback(async () => {
    setLoading(true);
    setAiError(null);
    try {
      const context = {
        location: data?.location
          ? {
              name: data.location.name,
              country: data.location.country,
              state: data.location.state,
              coordinates: data.location.coordinates,
            }
          : undefined,
        aqi: data?.aqi
          ? {
              value: data.aqi.value,
              category: data.aqi.category,
              scale: data.aqi.scale,
              methodology: data.aqi.methodology,
              dominantPollutant: data.aqi.dominantPollutant,
            }
          : undefined,
        aqiUnavailableReason: data?.aqiAvailability?.reason,
        pollutants: data?.pollutants,
        instantPollutants: data?.instantPollutants,
        hourlySummary: trendSummary,
        hourlyForecast: compactHourlyForecast(hourly),
        weather: data?.weather,
        preferences: {
          familyMembers: preferences.familyMembers,
          transportMode: preferences.transportMode,
          hasAirPurifier: preferences.hasAirPurifier,
        },
        dataSource: data?.sourceLabel,
        isDemo: data?.isDemo ?? false,
      };

      const question = `Generate a personalized 6-part dailyRoutine (morning, commute, outdoor-exercise, afternoon, evening, night) for a household with: ${preferences.familyMembers.join(', ')}. Use ONLY the supplied hourlySummary and current AQI (${data?.aqi ? `${data.aqi.value} ${data.aqi.category}` : 'incomplete/unavailable'}). Do not assume morning is cleaner; if no hourly window is <=100 AQI, recommend indoor activities instead of inventing an outdoor window.`;

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'AI plan generation unavailable');
      }

      const generated = json.response?.dailyRoutine;
      if (Array.isArray(generated) && generated.length >= 4) {
        setAiRoutine(generated);
      } else {
        throw new Error('AI response did not include a full dailyRoutine list; showing dynamic data-driven plan.');
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Could not reach AI service; using dynamic hourly-trend plan.');
      setAiRoutine(null);
    } finally {
      setLoading(false);
    }
  }, [data, hourly, preferences, trendSummary]);

  const toggleItem = (timeOfDay: TimeOfDay) => {
    const current = getCompletedSnapshot();
    const next = current.includes(timeOfDay)
      ? current.filter((id) => id !== timeOfDay)
      : [...current, timeOfDay];
    saveCompletedList(next);
  };

  const completed = routine.filter((r) => r.completed).length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-400" />
            Your Clean Air Plan
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Personalized daily routine driven by hourly model trends and family protection preferences
          </p>
        </div>
        <button
          onClick={generatePlanWithAI}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-teal-500/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Generating AI Plan...' : 'Refine with Gemini AI'}
        </button>
      </div>

      {/* Model Estimate & Uncertainty Notice */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-200">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-300" />
        <div className="space-y-1">
          <p className="font-semibold">Recommendation based on available hourly model estimates.</p>
          <p className="text-blue-200/90">{trendSummary.forecastUncertaintyNote}</p>
        </div>
      </div>

      {aiError && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Progress */}
      {routine.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-200">Today&apos;s Progress</span>
            <span className="text-sm font-semibold text-teal-300">{completed}/{routine.length} completed</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completed / routine.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Routine Cards */}
      <div className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-slate-300 text-sm">Generating personalized plan with Gemini AI...</p>
          </div>
        )}
        {!loading && routine.map((item) => (
          <RoutineCard key={item.timeOfDay} item={item} onToggle={toggleItem} />
        ))}
      </div>
    </div>
  );
}
