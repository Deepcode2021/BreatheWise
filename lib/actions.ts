// Daily action templates and transparent CO2e emission-factor calculations
import type { DailyAction } from '@/types';
import { generateId } from '@/lib/utils';

export type BaselineVehicleType = 'petrol-car' | 'diesel-car' | 'two-wheeler' | 'auto-rickshaw';
export type ChosenTransportMode = 'bus' | 'metro' | 'cycling-walking' | 'carpool' | 'avoided-trip';

export const BASELINE_VEHICLE_EF: Record<
  BaselineVehicleType,
  { label: string; efPerVehicleKm: number; defaultOccupancy: number; source: string }
> = {
  'petrol-car': {
    label: 'Petrol Car',
    efPerVehicleKm: 0.18,
    defaultOccupancy: 1,
    source: 'India GHG Program / MoEFCC passenger car avg (~0.18 kg CO₂e/vehicle-km)',
  },
  'diesel-car': {
    label: 'Diesel Car',
    efPerVehicleKm: 0.17,
    defaultOccupancy: 1,
    source: 'India GHG Program diesel car avg (~0.17 kg CO₂e/vehicle-km)',
  },
  'two-wheeler': {
    label: 'Two-Wheeler (Scooter/Motorcycle)',
    efPerVehicleKm: 0.045,
    defaultOccupancy: 1,
    source: 'India GHG Program 2-wheeler avg (~0.045 kg CO₂e/vehicle-km)',
  },
  'auto-rickshaw': {
    label: 'Auto-Rickshaw (CNG/Petrol)',
    efPerVehicleKm: 0.075,
    defaultOccupancy: 1,
    source: 'Urban 3-wheeler estimate (~0.075 kg CO₂e/vehicle-km)',
  },
};

export const CHOSEN_MODE_EF: Record<
  ChosenTransportMode,
  { label: string; efPerPassengerKm: number | null; source: string }
> = {
  bus: {
    label: 'Public Bus',
    efPerPassengerKm: 0.065,
    source: 'Urban city bus avg occupancy (~0.065 kg CO₂e/passenger-km)',
  },
  metro: {
    label: 'Metro / Electric Rail',
    efPerPassengerKm: 0.035,
    source: 'Electric urban rail using Indian grid factor (~0.035 kg CO₂e/passenger-km)',
  },
  'cycling-walking': {
    label: 'Cycling or Walking',
    efPerPassengerKm: 0,
    source: 'Zero tailpipe emissions (0 kg CO₂e/passenger-km)',
  },
  carpool: {
    label: 'Carpool (Shared Vehicle)',
    efPerPassengerKm: null, // Computed dynamically as baseline EF / chosenOccupancy
    source: 'Shared vehicle emissions divided equally across passengers',
  },
  'avoided-trip': {
    label: 'Avoided / Batched Trip',
    efPerPassengerKm: 0,
    source: 'Eliminated trip (0 kg CO₂e/passenger-km)',
  },
};

export interface TransportSavingsResult {
  co2SavedKg: number;
  baselineKg: number;
  chosenKg: number;
  assumptionText: string;
  baselineText: string;
  emissionFactorText: string;
}

/**
 * Computes transparent estimated CO2e savings for a single shifted or avoided trip:
 * Savings = max(0, (BaselineEF / BaselineOccupancy - ChosenEF) * DistanceKm)
 * Rounded to 1 decimal place to avoid false precision.
 */
export function calculateTransportCO2Savings(params: {
  distanceKm: number;
  baselineVehicle: BaselineVehicleType;
  baselineOccupancy: number;
  chosenMode: ChosenTransportMode;
  chosenOccupancy: number;
}): TransportSavingsResult {
  const dist = Math.max(0, Math.min(500, Number.isFinite(params.distanceKm) ? params.distanceKm : 0));
  const baseOcc = Math.max(1, Math.min(8, Math.round(params.baselineOccupancy || 1)));
  const chosenOcc = Math.max(2, Math.min(8, Math.round(params.chosenOccupancy || 2)));

  const baseInfo = BASELINE_VEHICLE_EF[params.baselineVehicle];
  const modeInfo = CHOSEN_MODE_EF[params.chosenMode];

  const baselinePerPassengerKm = baseInfo.efPerVehicleKm / baseOcc;
  const chosenPerPassengerKm =
    params.chosenMode === 'carpool'
      ? baseInfo.efPerVehicleKm / chosenOcc
      : (modeInfo.efPerPassengerKm ?? 0);

  const baselineKg = Math.round(baselinePerPassengerKm * dist * 10) / 10;
  const chosenKg = Math.round(chosenPerPassengerKm * dist * 10) / 10;
  const rawSaved = Math.max(0, (baselinePerPassengerKm - chosenPerPassengerKm) * dist);
  const co2SavedKg = Math.round(rawSaved * 10) / 10;

  const occupancyLabel =
    params.chosenMode === 'carpool'
      ? `shared by ${chosenOcc} passengers vs ${baseOcc} in baseline`
      : `baseline occupancy ${baseOcc}`;

  return {
    co2SavedKg,
    baselineKg,
    chosenKg,
    baselineText: `${baseInfo.label} (${baseInfo.efPerVehicleKm} kg CO₂e/vkm, ${baseOcc} pax)`,
    emissionFactorText:
      params.chosenMode === 'carpool'
        ? `Carpool: ${(baseInfo.efPerVehicleKm / chosenOcc).toFixed(3)} kg CO₂e/pkm`
        : `${modeInfo.label}: ${(modeInfo.efPerPassengerKm ?? 0).toFixed(3)} kg CO₂e/pkm`,
    assumptionText: `${dist} km trip replacing ${baseInfo.label} (${occupancyLabel}). ${baseInfo.source}; ${modeInfo.source}. Single-trip estimate; do not double-count with generic commute actions.`,
  };
}

interface ActionTemplate {
  category: 'transport' | 'indoor' | 'lifestyle' | 'community';
  action: string;
  co2Saved: number;
  baseline: string;
  emissionFactor: string;
  assumption: string;
  isImmediateCO2: boolean;
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    category: 'transport',
    action: 'Took Metro or Public Bus instead of a 10 km solo petrol car commute',
    co2Saved: 1.3,
    baseline: '10 km solo petrol car trip (1.8 kg CO₂e at 0.18 kg/vkm)',
    emissionFactor: 'Public bus/metro blended avg ~0.05 kg CO₂e/pkm (0.5 kg for 10 km)',
    assumption: '10 km one-way trip; net savings = 1.8 − 0.5 ≈ 1.3 kg CO₂e. Applies once per distinct trip (avoid double-counting with the trip calculator).',
    isImmediateCO2: true,
  },
  {
    category: 'transport',
    action: 'Walked or cycled one 2.5 km short errand instead of driving',
    co2Saved: 0.5,
    baseline: '2.5 km solo petrol car trip (0.18 kg CO₂e/vkm)',
    emissionFactor: 'Walking/cycling: 0.00 kg CO₂e/km tailpipe',
    assumption: '2.5 km round-trip short neighbourhood errand; 2.5 × 0.18 ≈ 0.5 kg CO₂e.',
    isImmediateCO2: true,
  },
  {
    category: 'transport',
    action: 'Batched errands to eliminate one 5 km solo car trip',
    co2Saved: 0.9,
    baseline: '5 km solo petrol car trip (0.18 kg CO₂e/vkm)',
    emissionFactor: 'Eliminated trip: 0.00 kg CO₂e',
    assumption: '5 km avoided trip by combining stops; 5 × 0.18 = 0.9 kg CO₂e.',
    isImmediateCO2: true,
  },
  {
    category: 'indoor',
    action: 'Kept windows closed during elevated outdoor pollution hours',
    co2Saved: 0,
    baseline: 'Open-window indoor air infiltration',
    emissionFactor: 'N/A — exposure reduction only',
    assumption: 'Reduces indoor PM2.5 infiltration; no direct CO₂e reduction claimed.',
    isImmediateCO2: false,
  },
  {
    category: 'indoor',
    action: 'Used damp mopping instead of dry sweeping',
    co2Saved: 0,
    baseline: 'Dry sweeping indoors',
    emissionFactor: 'N/A — dust control only',
    assumption: 'Prevents particle resuspension indoors; no direct CO₂e reduction claimed.',
    isImmediateCO2: false,
  },
  {
    category: 'indoor',
    action: 'Checked or cleaned AC / HEPA purifier pre-filter',
    co2Saved: 0,
    baseline: 'Unmaintained clogged filter',
    emissionFactor: 'N/A — indoor filtration maintenance',
    assumption: 'Supports designed airflow and CADR; no direct CO₂e reduction claimed.',
    isImmediateCO2: false,
  },
  {
    category: 'lifestyle',
    action: 'Diverted 1 kg of dry/garden waste from open burning',
    co2Saved: 0.8,
    baseline: 'Open burning of 1 kg dry mixed waste',
    emissionFactor: 'Mixed dry waste open combustion ~0.8 kg CO₂e/kg (IPCC waste guidelines)',
    assumption: 'Assumes 1 kg dry waste sent to municipal/compost stream instead of open burning; also avoids local PM2.5 smoke.',
    isImmediateCO2: true,
  },
  {
    category: 'lifestyle',
    action: 'Used reusable bag & bottle (avoided 2 single-use plastic items)',
    co2Saved: 0.1,
    baseline: '2 single-use LDPE/PET disposable items',
    emissionFactor: 'Lifecycle production/disposal ~0.04–0.05 kg CO₂e per item',
    assumption: 'Quantity: 2 disposable items avoided today (~0.1 kg CO₂e lifecycle estimate).',
    isImmediateCO2: true,
  },
  {
    category: 'lifestyle',
    action: 'Planted or cared for a tree/sapling',
    co2Saved: 0,
    baseline: 'No tree care / planting activity',
    emissionFactor: 'Long-term sequestration only (not counted as immediate daily savings)',
    assumption: 'Tree carbon uptake accrues slowly over years and depends on survival, species, and climate; 0 kg immediate CO₂e credited today.',
    isImmediateCO2: false,
  },
  {
    category: 'community',
    action: 'Shared verified AQI & indoor safety tips with household or neighbours',
    co2Saved: 0,
    baseline: 'No community outreach',
    emissionFactor: 'N/A — awareness action',
    assumption: 'Supports community awareness; behavioral multiplier is not quantified in kg CO₂e.',
    isImmediateCO2: false,
  },
  {
    category: 'community',
    action: 'Participated in a neighbourhood clean-up (diverted ~0.4 kg burnable litter)',
    co2Saved: 0.3,
    baseline: '0.4 kg dry litter exposed to open burning',
    emissionFactor: '~0.8 kg CO₂e/kg dry waste combustion',
    assumption: 'Estimated 0.4 kg per participant diverted to proper collection (~0.3 kg CO₂e).',
    isImmediateCO2: true,
  },
];

/**
 * Generates uncompleted daily action templates for today, excluding action titles already present.
 */
export function getTodayActions(existingActions: string[] = []): DailyAction[] {
  const today = new Date().toISOString().split('T')[0];
  const existingSet = new Set(existingActions);
  return ACTION_TEMPLATES.filter((t) => !existingSet.has(t.action)).map((t) => ({
    id: generateId(),
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

export interface WeeklyImpactPoint {
  day: string;
  actions: number;
  co2: number;
}

/**
 * Aggregates completed action counts and CO2e savings across the trailing `daysCount` days in O(N + D).
 */
export function buildWeeklyImpactData(
  allActions: DailyAction[],
  daysCount = 7,
  referenceDate = new Date()
): WeeklyImpactPoint[] {
  const grouped = new Map<string, { actions: number; co2: number }>();
  for (const act of allActions) {
    if (!act.completed) continue;
    let bucket = grouped.get(act.date);
    if (!bucket) {
      bucket = { actions: 0, co2: 0 };
      grouped.set(act.date, bucket);
    }
    bucket.actions += 1;
    bucket.co2 += act.co2Saved;
  }

  const days: WeeklyImpactPoint[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const bucket = grouped.get(dateStr);
    days.push({
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      actions: bucket?.actions ?? 0,
      co2: bucket ? Math.round(bucket.co2 * 10) / 10 : 0,
    });
  }
  return days;
}

/**
 * Computes the consecutive completed-action day streak ending today (or yesterday if today has no completions yet).
 */
export function calculateActionStreak(
  allActions: DailyAction[],
  maxDays = 30,
  referenceDate = new Date()
): number {
  const completedDates = new Set<string>();
  for (const act of allActions) {
    if (act.completed) completedDates.add(act.date);
  }

  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

/**
 * Computes per-category action completion totals for today's checklist.
 */
export function computeCategoryProgress(
  actions: DailyAction[]
): Record<string, { total: number; completed: number }> {
  const byCategory: Record<string, { total: number; completed: number }> = {};
  for (const act of actions) {
    if (!byCategory[act.category]) {
      byCategory[act.category] = { total: 0, completed: 0 };
    }
    byCategory[act.category].total += 1;
    if (act.completed) {
      byCategory[act.category].completed += 1;
    }
  }
  return byCategory;
}
