'use client';

import React, { useState, useSyncExternalStore, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { BarChart3, Flame, CheckCircle2, Circle, Leaf, TrendingUp, Calculator, Plus, Trash2 } from 'lucide-react';
import type { DailyAction } from '@/types';
import {
  ACTION_TEMPLATES,
  BASELINE_VEHICLE_EF,
  CHOSEN_MODE_EF,
  buildWeeklyImpactData,
  calculateActionStreak,
  calculateTransportCO2Savings,
  computeCategoryProgress,
  type BaselineVehicleType,
  type ChosenTransportMode,
} from '@/lib/actions';
import { generateId, cn } from '@/lib/utils';

const WeeklyImpactChart = dynamic(
  () => import('@/components/impact/WeeklyImpactChart').then((mod) => mod.WeeklyImpactChart),
  {
    ssr: false,
    loading: () => (
      <div className="glass-card rounded-2xl p-5" aria-busy="true" aria-label="Loading 7-day chart">
        <div className="h-5 w-44 rounded bg-slate-800 shimmer mb-4" />
        <div className="h-[170px] w-full rounded-xl bg-slate-800/50 shimmer" />
      </div>
    ),
  }
);

const TRACKER_KEY = 'breathewise_tracker_actions';
const trackerListeners = new Set<() => void>();
const EMPTY_ALL: DailyAction[] = [];

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function buildDefaultTodayActions(): DailyAction[] {
  const today = getTodayDateStr();
  return ACTION_TEMPLATES.map((t, idx) => ({
    id: `tpl-${today}-${idx}`,
    category: t.category,
    action: t.action,
    co2Saved: t.co2Saved,
    assumption: t.assumption,
    baseline: t.baseline,
    emissionFactor: t.emissionFactor,
    isImmediateCO2: t.isImmediateCO2,
    completed: false,
    date: today,
  }));
}

let cachedRawTracker: string | null = null;
let cachedAllActions: DailyAction[] = EMPTY_ALL;

function subscribeTracker(callback: () => void) {
  trackerListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === TRACKER_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    trackerListeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getAllActionsSnapshot(): DailyAction[] {
  if (typeof window === 'undefined') return EMPTY_ALL;
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (raw !== cachedRawTracker) {
      cachedRawTracker = raw;
      const parsed: unknown = raw ? JSON.parse(raw) : EMPTY_ALL;
      cachedAllActions = Array.isArray(parsed) ? (parsed as DailyAction[]) : EMPTY_ALL;
    }
    return cachedAllActions;
  } catch {
    return EMPTY_ALL;
  }
}

function getAllActionsServerSnapshot(): DailyAction[] {
  return EMPTY_ALL;
}

function saveTodayActions(todayActions: DailyAction[]) {
  if (typeof window === 'undefined') return;
  const all = getAllActionsSnapshot();
  const today = getTodayDateStr();
  const others = all.filter((a) => a.date !== today);
  const nextAll = [...others, ...todayActions];
  const serialized = JSON.stringify(nextAll);
  try {
    localStorage.setItem(TRACKER_KEY, serialized);
  } catch {}
  cachedRawTracker = serialized;
  cachedAllActions = nextAll;
  trackerListeners.forEach((l) => l());
}

const CATEGORY_COLORS: Record<string, string> = {
  transport: '#14b8a6',
  indoor: '#6366f1',
  lifestyle: '#34d399',
  community: '#f59e0b',
};

const CATEGORY_LABELS: Record<string, string> = {
  transport: 'Transport',
  indoor: 'Indoor',
  lifestyle: 'Lifestyle',
  community: 'Community',
};

export default function ImpactPage() {
  const allActions = useSyncExternalStore(
    subscribeTracker,
    getAllActionsSnapshot,
    getAllActionsServerSnapshot
  );

  // Custom trip calculator state
  const [distanceKm, setDistanceKm] = useState<string>('10');
  const [baselineVehicle, setBaselineVehicle] = useState<BaselineVehicleType>('petrol-car');
  const [baselineOccupancy, setBaselineOccupancy] = useState<number>(1);
  const [chosenMode, setChosenMode] = useState<ChosenTransportMode>('metro');
  const [chosenOccupancy, setChosenOccupancy] = useState<number>(2);

  const today = getTodayDateStr();
  const actions = useMemo(() => {
    const storedToday = allActions.filter((a) => a.date === today);
    return storedToday.length > 0 ? storedToday : buildDefaultTodayActions();
  }, [allActions, today]);

  const weeklyData = useMemo(() => buildWeeklyImpactData(allActions, 7), [allActions]);
  const weeklyTotalActions = useMemo(
    () => weeklyData.reduce((sum, d) => sum + d.actions, 0),
    [weeklyData]
  );

  const streak = useMemo(() => calculateActionStreak(allActions, 30), [allActions]);
  const completedCount = useMemo(() => actions.filter((a) => a.completed).length, [actions]);
  const totalCo2 = useMemo(
    () =>
      Math.round(
        actions
          .filter((a) => a.completed)
          .reduce((sum, a) => sum + a.co2Saved, 0) * 10
      ) / 10,
    [actions]
  );
  const byCategory = useMemo(() => computeCategoryProgress(actions), [actions]);
  const templateActionNames = useMemo(() => new Set(ACTION_TEMPLATES.map((t) => t.action)), []);

  const parsedDistance = Math.max(0, Number.parseFloat(distanceKm) || 0);
  const tripEstimate = useMemo(
    () =>
      calculateTransportCO2Savings({
        distanceKm: parsedDistance,
        baselineVehicle,
        baselineOccupancy,
        chosenMode,
        chosenOccupancy,
      }),
    [parsedDistance, baselineVehicle, baselineOccupancy, chosenMode, chosenOccupancy]
  );

  const toggleAction = useCallback(
    (id: string) => {
      const updated = actions.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a));
      saveTodayActions(updated);
    },
    [actions]
  );

  const logCustomTrip = useCallback(() => {
    if (parsedDistance <= 0) return;
    const modeLabel = CHOSEN_MODE_EF[chosenMode].label;
    const baseLabel = BASELINE_VEHICLE_EF[baselineVehicle].label;
    const customAction: DailyAction = {
      id: generateId(),
      category: 'transport',
      action: `Logged ${parsedDistance} km trip: ${modeLabel} instead of ${baseLabel}`,
      co2Saved: tripEstimate.co2SavedKg,
      baseline: tripEstimate.baselineText,
      emissionFactor: tripEstimate.emissionFactorText,
      assumption: tripEstimate.assumptionText,
      isImmediateCO2: tripEstimate.co2SavedKg > 0,
      completed: true,
      date: today,
    };
    saveTodayActions([customAction, ...actions]);
  }, [parsedDistance, chosenMode, baselineVehicle, tripEstimate, today, actions]);

  const removeCustomAction = useCallback(
    (id: string) => {
      saveTodayActions(actions.filter((a) => a.id !== id));
    },
    [actions]
  );

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-teal-400" />
          My Environmental Impact
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Track completed actions and estimate single-trip CO₂e reductions with transparent emission factors
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Actions Today', value: `${completedCount}/${actions.length}`, icon: CheckCircle2, color: '#14b8a6' },
          { label: 'Est. CO₂e Today', value: `~${totalCo2.toFixed(1)} kg`, icon: Leaf, color: '#34d399', note: 'modeled estimate' },
          { label: 'Day Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, icon: Flame, color: '#f59e0b' },
          { label: '7-Day Total', value: `${weeklyTotalActions} actions`, icon: TrendingUp, color: '#a78bfa' },
        ].map(({ label, value, icon: Icon, color, note }) => (
          <div key={label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs text-slate-300">{label}</span>
            </div>
            <div className="text-xl font-bold text-white">{value}</div>
            {note && <div className="text-xs text-slate-400 mt-0.5">{note}</div>}
          </div>
        ))}
      </div>

      {/* Custom Trip CO2e Calculator */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-teal-400" />
          <h2 className="text-base font-semibold text-white">Custom Trip CO₂e Calculator</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="trip-distance" className="block text-xs font-medium text-slate-300 mb-1">
              Travel Distance (km)
            </label>
            <input
              id="trip-distance"
              type="number"
              min="0.5"
              max="500"
              step="0.5"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-teal-400"
            />
          </div>

          <div>
            <label htmlFor="chosen-mode" className="block text-xs font-medium text-slate-300 mb-1">
              Transport Mode Used
            </label>
            <select
              id="chosen-mode"
              value={chosenMode}
              onChange={(e) => setChosenMode(e.target.value as ChosenTransportMode)}
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-teal-400"
            >
              {Object.entries(CHOSEN_MODE_EF).map(([val, info]) => (
                <option key={val} value={val}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="baseline-vehicle" className="block text-xs font-medium text-slate-300 mb-1">
              Replaced Vehicle Type
            </label>
            <select
              id="baseline-vehicle"
              value={baselineVehicle}
              onChange={(e) => setBaselineVehicle(e.target.value as BaselineVehicleType)}
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-teal-400"
            >
              {Object.entries(BASELINE_VEHICLE_EF).map(([val, info]) => (
                <option key={val} value={val}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="occupancy-input" className="block text-xs font-medium text-slate-300 mb-1">
              {chosenMode === 'carpool' ? 'Carpool Occupancy (people)' : 'Baseline Vehicle Occupancy'}
            </label>
            <input
              id="occupancy-input"
              type="number"
              min={chosenMode === 'carpool' ? 2 : 1}
              max={6}
              value={chosenMode === 'carpool' ? chosenOccupancy : baselineOccupancy}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                if (chosenMode === 'carpool') setChosenOccupancy(Math.max(2, n));
                else setBaselineOccupancy(n);
              }}
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
          <div className="space-y-1 text-xs" role="status" aria-live="polite">
            <div className="text-slate-200 font-medium">
              Estimated savings:{' '}
              <span className="text-teal-300 font-bold text-sm">~{tripEstimate.co2SavedKg.toFixed(1)} kg CO₂e</span>{' '}
              (Baseline ~{tripEstimate.baselineKg.toFixed(1)} kg − Mode ~{tripEstimate.chosenKg.toFixed(1)} kg)
            </div>
            <p className="text-slate-400">{tripEstimate.assumptionText}</p>
          </div>
          <button
            onClick={logCustomTrip}
            disabled={parsedDistance <= 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 text-white text-xs font-semibold hover:bg-teal-400 disabled:opacity-40 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Log Trip
          </button>
        </div>
      </div>

      {/* Weekly Chart */}
      {weeklyData.length > 0 && (
        <WeeklyImpactChart weeklyData={weeklyData} weeklyTotalActions={weeklyTotalActions} />
      )}

      {/* Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/40 text-xs text-slate-300 leading-relaxed">
        CO₂e numbers are <strong className="text-white">estimates rounded to 1 decimal place</strong> using published transport and waste emission factors (India GHG Program, MoEFCC, IPCC). To prevent double-counting, only log each distinct trip once. Tree planting/care does not receive immediate daily carbon credit.
      </div>

      {/* Category Progress */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">By Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(byCategory).map(([cat, { total, completed: comp }]) => (
            <div key={cat} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="text-xs font-semibold text-teal-300">{comp}/{total}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full w-full rounded-full origin-left transition-transform duration-500"
                  style={{
                    transform: `scaleX(${total > 0 ? comp / total : 0})`,
                    backgroundColor: CATEGORY_COLORS[cat] ?? '#14b8a6',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Actions List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Today&apos;s Actions
        </h2>
        <div className="space-y-2.5">
          {actions.map((action) => {
            const isCustom = !templateActionNames.has(action.action);
            return (
              <div
                key={action.id}
                className={cn(
                  'flex items-start gap-3 p-4 glass-card rounded-xl',
                  action.completed && 'border-teal-500/30'
                )}
              >
                <button
                  onClick={() => toggleAction(action.id)}
                  className="mt-0.5 flex-shrink-0"
                  aria-pressed={action.completed}
                  aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {action.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-500 hover:text-teal-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm font-medium text-slate-100', action.completed && 'line-through text-slate-400')}>
                      {action.action}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {action.co2Saved > 0 ? (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: CATEGORY_COLORS[action.category] }}
                        >
                          ~{action.co2Saved.toFixed(1)} kg CO₂e
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0 kg CO₂e</span>
                      )}
                      {isCustom && (
                        <button
                          onClick={() => removeCustomAction(action.id)}
                          className="text-slate-400 hover:text-red-300 p-0.5"
                          aria-label="Remove logged trip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[action.category]}18`,
                        color: CATEGORY_COLORS[action.category],
                      }}
                    >
                      {CATEGORY_LABELS[action.category] ?? action.category}
                    </span>
                    {action.baseline && (
                      <span className="text-[11px] text-slate-300">Baseline: {action.baseline}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{action.assumption}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
