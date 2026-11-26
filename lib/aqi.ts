// AQI interpretation and calculation logic based on official Indian CPCB National AQI (NAQI) methodology
import type {
  AQIAvailability,
  AQICategory,
  AQIInfo,
  AQIScale,
  PollutantAveragingInfo,
  PollutantKey,
  Pollutants,
} from '@/types';

export const CPCB_METHODOLOGY_LABEL = 'Estimated Indian AQI — CPCB breakpoint methodology';

// Official CPCB National Air Quality Index categories & health guidance
const CPCB_BREAKPOINTS: Array<{
  range: [number, number];
  category: AQICategory;
  color: string;
  bgColor: string;
  description: string;
  healthImplication: string;
}> = [
  {
    range: [0, 50],
    category: 'Good',
    color: '#00C853',
    bgColor: '#E8F5E9',
    description: 'Air quality is good (0–50)',
    healthImplication: 'Minimal impact on health. Normal outdoor activities are generally suitable.',
  },
  {
    range: [51, 100],
    category: 'Satisfactory',
    color: '#76FF03',
    bgColor: '#F9FBE7',
    description: 'Air quality is satisfactory (51–100)',
    healthImplication: 'May cause minor breathing discomfort to sensitive individuals.',
  },
  {
    range: [101, 200],
    category: 'Moderate',
    color: '#FFAB00',
    bgColor: '#FFF8E1',
    description: 'Air quality is moderate (101–200)',
    healthImplication:
      'May cause breathing discomfort to people with lung disease such as asthma, and discomfort to people with heart disease, children and older adults.',
  },
  {
    range: [201, 300],
    category: 'Poor',
    color: '#FF6D00',
    bgColor: '#FBE9E7',
    description: 'Air quality is poor (201–300)',
    healthImplication:
      'May cause breathing discomfort to most people on prolonged exposure, and discomfort to people with heart disease on short exposure.',
  },
  {
    range: [301, 400],
    category: 'Very Poor',
    color: '#D50000',
    bgColor: '#FFEBEE',
    description: 'Air quality is very poor (301–400)',
    healthImplication:
      'May cause respiratory illness to people on prolonged exposure. Effects may be more pronounced in people with lung and heart diseases.',
  },
  {
    range: [401, 500],
    category: 'Severe',
    color: '#6A0080',
    bgColor: '#F3E5F5',
    description: 'Air quality is severe (401–500)',
    healthImplication:
      'May cause respiratory impact even on healthy people, and serious health impacts on people with lung/heart disease even during light physical activity.',
  },
];

/**
 * Maps a numeric Indian CPCB AQI value (0-500) to its official category, color palette, and health implication.
 */
export function getCPCBCategory(aqi: number, metadata?: Partial<AQIInfo>): AQIInfo {
  const clamped = Math.max(0, Math.min(500, Math.round(aqi)));
  const bp =
    CPCB_BREAKPOINTS.find((b) => clamped >= b.range[0] && clamped <= b.range[1]) ??
    CPCB_BREAKPOINTS[CPCB_BREAKPOINTS.length - 1];

  return {
    value: clamped,
    category: bp.category,
    scale: 'India_CPCB',
    methodology: CPCB_METHODOLOGY_LABEL,
    color: bp.color,
    bgColor: bp.bgColor,
    description: bp.description,
    healthImplication: bp.healthImplication,
    ...metadata,
  };
}

interface Breakpoint {
  lo: number;
  hi: number;
  ilo: number;
  ihi: number;
}

/**
 * Compute CPCB pollutant sub-index using linear interpolation:
 * I_p = round(((I_HI - I_LO) / (B_HI - B_LO)) * (C_p - B_LO) + I_LO)
 * Uses continuous half-open intervals (lo, hi] after [0, hi_0] so fractional concentrations
 * never fall into integer gaps. Values above the highest Severe upper anchor are capped at 500.
 */
export function computeSubIndex(
  concentration: number,
  breakpoints: Breakpoint[]
): number | null {
  if (!Number.isFinite(concentration) || concentration < 0) return null;

  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    const inBand =
      i === 0
        ? concentration >= bp.lo && concentration <= bp.hi
        : concentration > bp.lo && concentration <= bp.hi;

    if (inBand) {
      return Math.round(
        ((bp.ihi - bp.ilo) / (bp.hi - bp.lo)) * (concentration - bp.lo) + bp.ilo
      );
    }
  }

  const last = breakpoints[breakpoints.length - 1];
  if (concentration > last.hi) {
    return 500;
  }

  return null;
}

// Official CPCB Breakpoints:
// PM2.5 (24-hr avg, µg/m³): 0-30, 31-60, 61-90, 91-120, 121-250, 250+
export const PM25_BP: Breakpoint[] = [
  { lo: 0, hi: 30, ilo: 0, ihi: 50 },
  { lo: 30, hi: 60, ilo: 51, ihi: 100 },
  { lo: 60, hi: 90, ilo: 101, ihi: 200 },
  { lo: 90, hi: 120, ilo: 201, ihi: 300 },
  { lo: 120, hi: 250, ilo: 301, ihi: 400 },
  { lo: 250, hi: 380, ilo: 401, ihi: 500 },
];

// PM10 (24-hr avg, µg/m³): 0-50, 51-100, 101-250, 251-350, 351-430, 430+
export const PM10_BP: Breakpoint[] = [
  { lo: 0, hi: 50, ilo: 0, ihi: 50 },
  { lo: 50, hi: 100, ilo: 51, ihi: 100 },
  { lo: 100, hi: 250, ilo: 101, ihi: 200 },
  { lo: 250, hi: 350, ilo: 201, ihi: 300 },
  { lo: 350, hi: 430, ilo: 301, ihi: 400 },
  { lo: 430, hi: 510, ilo: 401, ihi: 500 },
];

// NO2 (24-hr avg, µg/m³): 0-40, 41-80, 81-180, 181-280, 281-400, 400+
export const NO2_BP: Breakpoint[] = [
  { lo: 0, hi: 40, ilo: 0, ihi: 50 },
  { lo: 40, hi: 80, ilo: 51, ihi: 100 },
  { lo: 80, hi: 180, ilo: 101, ihi: 200 },
  { lo: 180, hi: 280, ilo: 201, ihi: 300 },
  { lo: 280, hi: 400, ilo: 301, ihi: 400 },
  { lo: 400, hi: 520, ilo: 401, ihi: 500 },
];

// SO2 (24-hr avg, µg/m³): 0-40, 41-80, 81-380, 381-800, 801-1600, 1600+
export const SO2_BP: Breakpoint[] = [
  { lo: 0, hi: 40, ilo: 0, ihi: 50 },
  { lo: 40, hi: 80, ilo: 51, ihi: 100 },
  { lo: 80, hi: 380, ilo: 101, ihi: 200 },
  { lo: 380, hi: 800, ilo: 201, ihi: 300 },
  { lo: 800, hi: 1600, ilo: 301, ihi: 400 },
  { lo: 1600, hi: 2400, ilo: 401, ihi: 500 },
];

// CO (8-hr avg, mg/m³): 0-1.0, 1.1-2.0, 2.1-10, 10.1-17, 17.1-34, 34+
export const CO_BP: Breakpoint[] = [
  { lo: 0, hi: 1, ilo: 0, ihi: 50 },
  { lo: 1, hi: 2, ilo: 51, ihi: 100 },
  { lo: 2, hi: 10, ilo: 101, ihi: 200 },
  { lo: 10, hi: 17, ilo: 201, ihi: 300 },
  { lo: 17, hi: 34, ilo: 301, ihi: 400 },
  { lo: 34, hi: 51, ilo: 401, ihi: 500 },
];

// O3 (8-hr avg, µg/m³): 0-50, 51-100, 101-168, 169-208, 209-748, 748+
export const O3_BP: Breakpoint[] = [
  { lo: 0, hi: 50, ilo: 0, ihi: 50 },
  { lo: 50, hi: 100, ilo: 51, ihi: 100 },
  { lo: 100, hi: 168, ilo: 101, ihi: 200 },
  { lo: 168, hi: 208, ilo: 201, ihi: 300 },
  { lo: 208, hi: 748, ilo: 301, ihi: 400 },
  { lo: 748, hi: 1000, ilo: 401, ihi: 500 },
];

export const POLLUTANT_AVERAGING_RULES: Record<
  PollutantKey,
  { windowHours: 24 | 8; minValidHours: number; unit: string; breakpoints: Breakpoint[] }
> = {
  pm25: { windowHours: 24, minValidHours: 16, unit: 'µg/m³', breakpoints: PM25_BP },
  pm10: { windowHours: 24, minValidHours: 16, unit: 'µg/m³', breakpoints: PM10_BP },
  no2: { windowHours: 24, minValidHours: 16, unit: 'µg/m³', breakpoints: NO2_BP },
  so2: { windowHours: 24, minValidHours: 16, unit: 'µg/m³', breakpoints: SO2_BP },
  co: { windowHours: 8, minValidHours: 6, unit: 'µg/m³', breakpoints: CO_BP },
  o3: { windowHours: 8, minValidHours: 6, unit: 'µg/m³', breakpoints: O3_BP },
};

export interface WindowAverageResult {
  average: number | null;
  validHours: number;
  requiredHours: number;
  windowHours: 24 | 8;
  isSufficient: boolean;
}

/**
 * Computes mean over a window of hourly values while enforcing CPCB data-availability requirements:
 * - 24h pollutants (PM2.5, PM10, NO2, SO2): >= 16 valid hours out of 24
 * - 8h pollutants (CO, O3): >= 6 valid hours out of 8
 */
export function calculateWindowAverage(
  values: Array<number | null | undefined>,
  windowHours: 24 | 8,
  minValidHours: number
): WindowAverageResult {
  const slice = values.slice(-windowHours);
  const valid = slice.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  );
  const isSufficient = valid.length >= minValidHours;

  if (!isSufficient || valid.length === 0) {
    return {
      average: null,
      validHours: valid.length,
      requiredHours: minValidHours,
      windowHours,
      isSufficient: false,
    };
  }

  const sum = valid.reduce((acc, v) => acc + v, 0);
  return {
    average: Math.round((sum / valid.length) * 10) / 10,
    validHours: valid.length,
    requiredHours: minValidHours,
    windowHours,
    isSufficient: true,
  };
}

export interface HourlyPollutantWindows {
  pm25?: Array<number | null | undefined>;
  pm10?: Array<number | null | undefined>;
  no2?: Array<number | null | undefined>;
  so2?: Array<number | null | undefined>;
  co?: Array<number | null | undefined>; // µg/m³
  o3?: Array<number | null | undefined>;
}

export interface CPCBCalculationResult {
  aqi: AQIInfo | null;
  averagedPollutants: Pollutants;
  availability: AQIAvailability;
}

/**
 * Calculates CPCB AQI from hourly pollutant windows ending at the target timestamp:
 * 1. Computes 24h averages for PM2.5, PM10, NO2, SO2 (min 16/24h valid)
 * 2. Computes 8h averages for CO (converted µg/m³ -> mg/m³) and O3 (min 6/8h valid)
 * 3. Enforces CPCB validity rule: at least 3 valid pollutant sub-indices AND at least 1 of PM2.5 or PM10
 * 4. Returns maximum valid pollutant sub-index, or incomplete state with reason if criteria are unmet.
 */
export function calculateCPCBAQIFromWindows(
  windows: HourlyPollutantWindows,
  instantPollutants?: Partial<Pollutants>
): CPCBCalculationResult {
  const keys: PollutantKey[] = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];
  const perPollutant = {} as Record<PollutantKey, PollutantAveragingInfo>;
  const averagedPollutants: Pollutants = {
    pm25: null,
    pm10: null,
    no2: null,
    so2: null,
    co: null,
    o3: null,
  };
  const subIndices: Partial<Record<PollutantKey, number>> = {};
  const validPollutants: PollutantKey[] = [];
  let hasPM = false;

  for (const key of keys) {
    const rule = POLLUTANT_AVERAGING_RULES[key];
    const series = windows[key] ?? [];
    const avgResult = calculateWindowAverage(series, rule.windowHours, rule.minValidHours);
    const instant = instantPollutants?.[key] ?? null;

    let subIdx: number | null = null;
    if (avgResult.isSufficient && avgResult.average !== null) {
      // CO from Open-Meteo is in µg/m³; CPCB CO breakpoints are in mg/m³
      const calcConcentration = key === 'co' ? avgResult.average / 1000 : avgResult.average;
      subIdx = computeSubIndex(calcConcentration, rule.breakpoints);
    }

    perPollutant[key] = {
      average: avgResult.average,
      instant: typeof instant === 'number' && Number.isFinite(instant) && instant >= 0 ? instant : null,
      validHours: avgResult.validHours,
      requiredHours: rule.minValidHours,
      windowHours: rule.windowHours,
      isSufficient: avgResult.isSufficient,
      unit: rule.unit,
      subIndex: subIdx,
    };

    averagedPollutants[key] = avgResult.average;

    if (subIdx !== null) {
      subIndices[key] = subIdx;
      validPollutants.push(key);
      if (key === 'pm25' || key === 'pm10') {
        hasPM = true;
      }
    }
  }

  const meetsMinimumCount = validPollutants.length >= 3;

  if (!meetsMinimumCount || !hasPM) {
    const reasons: string[] = [];
    if (!hasPM) {
      reasons.push('neither PM2.5 nor PM10 met the 16/24-hour averaging requirement');
    }
    if (!meetsMinimumCount) {
      reasons.push(`only ${validPollutants.length} of 3 required pollutants met averaging thresholds`);
    }

    return {
      aqi: null,
      averagedPollutants,
      availability: {
        isValid: false,
        reason: `Estimated CPCB AQI unavailable: ${reasons.join('; ')}. Individual model pollutant concentrations are shown below.`,
        validPollutants,
        hasPM,
        perPollutant,
      },
    };
  }

  let maxVal = -1;
  let dominantPollutant: PollutantKey | undefined;
  for (const key of validPollutants) {
    const val = subIndices[key];
    if (val !== undefined && val > maxVal) {
      maxVal = val;
      dominantPollutant = key;
    }
  }

  const aqi = getCPCBCategory(maxVal, {
    methodology: CPCB_METHODOLOGY_LABEL,
    dominantPollutant,
    subIndices,
    validPollutantCount: validPollutants.length,
  });

  return {
    aqi,
    averagedPollutants,
    availability: {
      isValid: true,
      validPollutants,
      hasPM,
      perPollutant,
    },
  };
}

/**
 * Direct CPCB AQI calculation when pre-averaged (24h/8h) pollutant concentrations are already known.
 * Enforces the CPCB minimum data rule: >= 3 valid pollutants, including PM2.5 or PM10.
 */
export function calculateCPCBAQI(
  averagedPollutants: Pollutants,
  options: { enforceMinimumCriteria?: boolean } = {}
): AQIInfo | null {
  const { enforceMinimumCriteria = true } = options;
  const subIndices: Partial<Record<PollutantKey, number>> = {};
  const validKeys: PollutantKey[] = [];

  const check = (key: PollutantKey, raw: number | null, bp: Breakpoint[], divideBy = 1) => {
    if (raw === null || !Number.isFinite(raw) || raw < 0) return;
    const si = computeSubIndex(raw / divideBy, bp);
    if (si !== null) {
      subIndices[key] = si;
      validKeys.push(key);
    }
  };

  check('pm25', averagedPollutants.pm25, PM25_BP);
  check('pm10', averagedPollutants.pm10, PM10_BP);
  check('no2', averagedPollutants.no2, NO2_BP);
  check('so2', averagedPollutants.so2, SO2_BP);
  check('co', averagedPollutants.co, CO_BP, 1000);
  check('o3', averagedPollutants.o3, O3_BP);

  if (validKeys.length === 0) return null;

  const hasPM = validKeys.includes('pm25') || validKeys.includes('pm10');
  if (enforceMinimumCriteria && (validKeys.length < 3 || !hasPM)) {
    return null;
  }

  let maxVal = -1;
  let dominantPollutant: PollutantKey | undefined;
  for (const key of validKeys) {
    const val = subIndices[key];
    if (val !== undefined && val > maxVal) {
      maxVal = val;
      dominantPollutant = key;
    }
  }

  return getCPCBCategory(maxVal, {
    methodology: CPCB_METHODOLOGY_LABEL,
    dominantPollutant,
    subIndices,
    validPollutantCount: validKeys.length,
  });
}

/**
 * Returns the canonical hex badge color associated with an Indian CPCB AQI category.
 */
export function getAQICategoryColor(category: AQICategory): string {
  const map: Record<AQICategory, string> = {
    Good: '#00C853',
    Satisfactory: '#76FF03',
    Moderate: '#FFAB00',
    Poor: '#FF6D00',
    'Very Poor': '#D50000',
    Severe: '#6A0080',
    Hazardous: '#3E0040',
    Unknown: '#94a3b8',
  };
  return map[category] ?? '#94a3b8';
}

/**
 * Evaluates an averaged pollutant concentration against CPCB NAAQS benchmark thresholds
 * (like-for-like averaging periods: 24h avg for PM2.5/PM10/NO2/SO2, 8h avg for CO/O3).
 */
export function getPollutantStatus(
  key: string,
  value: number
): 'below_benchmark' | 'moderate' | 'above_benchmark' {
  const limits: Record<string, [number, number]> = {
    pm25: [30, 60],       // 24h avg µg/m³
    pm10: [50, 100],      // 24h avg µg/m³
    no2: [40, 80],        // 24h avg µg/m³
    so2: [40, 80],        // 24h avg µg/m³
    co: [1000, 2000],     // 8h avg µg/m³ (= 1–2 mg/m³)
    o3: [50, 100],        // 8h avg µg/m³
  };
  const lim = limits[key];
  if (!lim) return 'below_benchmark';
  if (value <= lim[0]) return 'below_benchmark';
  if (value <= lim[1]) return 'moderate';
  return 'above_benchmark';
}

/**
 * Formats an internal AQIScale identifier into a human-readable methodology string.
 */
export function formatAQIScale(scale: AQIScale): string {
  const labels: Record<AQIScale, string> = {
    India_CPCB: CPCB_METHODOLOGY_LABEL,
    US_AQI: 'US AQI',
    European: 'European AQI',
    OpenMeteo_Index: 'Open-Meteo European AQI Index (model estimate)',
  };
  return labels[scale] ?? scale;
}
