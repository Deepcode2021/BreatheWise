'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { BarChart3, Flame, CheckCircle2, Circle, Leaf, TrendingUp, Calculator, Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyAction } from '@/types';
import {
  ACTION_TEMPLATES,
  BASELINE_VEHICLE_EF,
  CHOSEN_MODE_EF,
  calculateTransportCO2Savings,
  type BaselineVehicleType,
  type ChosenTransportMode,
} from '@/lib/actions';
import { generateId, cn } from '@/lib/utils';

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
      const parsed = raw ? (JSON.parse(raw) as DailyAction[]) : EMPTY_ALL;
      cachedAllActions = Array.isArray(parsed) ? parsed : EMPTY_ALL;
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
  const storedToday = allActions.filter((a) => a.date === today);
  const actions = storedToday.length > 0 ? storedToday : buildDefaultTodayActions();

  const weeklyData = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayActions = allActions.filter((a) => a.date === dateStr && a.completed);
      days.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        actions: dayActions.length,
        co2: Math.round(dayActions.reduce((s, a) => s + a.co2Saved, 0) * 10) / 10,
      });
    }
    return days;
  })();

  const toggleAction = (id: string) => {
    const updated = actions.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a));
    saveTodayActions(updated);
  };

  const parsedDistance = Math.max(0, parseFloat(distanceKm) || 0);
  const tripEstimate = calculateTransportCO2Savings({
    distanceKm: parsedDistance,
    baselineVehicle,
    baselineOccupancy,
    chosenMode,
    chosenOccupancy,
  });

  const logCustomTrip = () => {
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
  };

  const removeCustomAction = (id: string) => {
    saveTodayActions(actions.filter((a) => a.id !== id));
  };

  const completed = actions.filter((a) => a.completed);
  const totalCo2 = Math.round(completed.reduce((s, a) => s + a.co2Saved, 0) * 10) / 10;
  const weeklyTotalActions = weeklyData.reduce((s, d) => s + d.actions, 0);

  const byCategory = actions.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = { total: 0, completed: 0 };
    acc[a.category].total++;
    if (a.completed) acc[a.category].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  const streak = (() => {
    let s = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (allActions.some((a) => a.date === dateStr && a.completed)) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  const templateActionNames = new Set(ACTION_TEMPLATES.map((t) => t.action));

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
          { label: 'Actions Today', value: `${completed.length}/${actions.length}`, icon: CheckCircle2, color: '#14b8a6' },
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
                const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                if (chosenMode === 'carpool') setChosenOccupancy(Math.max(2, n));
                else setBaselineOccupancy(n);
              }}
              className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-sm text-white focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
          <div className="space-y-1 text-xs">
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
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 text-white text-xs font-semibold hover:bg-teal-400 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Log Trip
          </button>
        </div>
      </div>

      {/* Weekly Chart */}
      {weeklyData.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
            <h3 className="text-sm font-semibold text-slate-200">7-Day Completed Actions</h3>
            <span className="text-xs text-slate-400">Stored locally in your browser</span>
          </div>

          {weeklyTotalActions === 0 && (
            <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300">
              No actions completed in the last 7 days yet. Check off an action below or log a trip above to see your daily bars grow.
            </div>
          )}

          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
              <YAxis
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(20, 184, 166, 0.12)' }}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(100,116,139,0.45)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#f1f5f9',
                }}
                labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
              />
              <Bar
                dataKey="actions"
                fill="#14b8a6"
                radius={[4, 4, 0, 0]}
                minPointSize={2}
                name="Completed Actions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${total > 0 ? (comp / total) * 100 : 0}%`,
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
                  'flex items-start gap-3 p-4 glass-card rounded-xl transition-colors duration-200',
                  action.completed && 'border-teal-500/30'
                )}
              >
                <button
                  onClick={() => toggleAction(action.id)}
                  className="mt-0.5 flex-shrink-0 transition-colors"
                  aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {action.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-500 hover:text-teal-400 transition-colors" />
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
