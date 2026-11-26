// Dynamic daily routine generator driven by hourly model trends, CPCB AQI guidance, and family preferences
import type {
  AQICategory,
  AQIInfo,
  DailyRoutineItem,
  HourlyDataPoint,
  Pollutants,
  UserPreferences,
} from '@/types';

export interface CleanWindow {
  startTime: string;
  endTime: string;
  label: string;
  minAqi: number;
  maxAqi: number;
  hours: number;
}

export interface HourlyTrendSummary {
  hasHourlyData: boolean;
  minAqi: number | null;
  maxAqi: number | null;
  bestHourLabel: string | null;
  bestHourAqi: number | null;
  worstHourLabel: string | null;
  worstHourAqi: number | null;
  hasGoodOrSatisfactoryWindow: boolean;
  cleanWindowRange: string | null;
  contiguousCleanWindows: CleanWindow[];
  forecastUncertaintyNote: string;
  bucketAverages: {
    morning: number | null;   // 06:00 - 09:59
    afternoon: number | null; // 10:00 - 15:59
    evening: number | null;   // 16:00 - 20:59
    night: number | null;     // 21:00 - 05:59
  };
}

function formatHourOnly(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const hr = d.getHours().toString().padStart(2, '0');
      return `${hr}:00`;
    }
  } catch {}
  return iso.slice(11, 16) || iso;
}

function formatDayHour(iso: string, firstDateStr: string): string {
  const hrLabel = formatHourOnly(iso);
  const datePart = iso.slice(0, 10);
  if (!datePart || datePart === firstDateStr) return hrLabel;
  return `Tomorrow ${hrLabel}`;
}

/**
 * Finds strictly contiguous, chronological windows where hourly estimated AQI <= maxThreshold.
 * Never merges separate windows across a polluted interval.
 */
export function findContiguousCleanWindows(
  hourlyPoints: HourlyDataPoint[],
  maxThreshold = 100
): CleanWindow[] {
  if (hourlyPoints.length === 0) return [];
  const firstDateStr = hourlyPoints[0].time.slice(0, 10);
  const windows: CleanWindow[] = [];

  let active: HourlyDataPoint[] = [];

  const flush = () => {
    if (active.length === 0) return;
    const startPt = active[0];
    const endPt = active[active.length - 1];
    const aqis = active.map((p) => p.aqi!);
    const startLabel = formatDayHour(startPt.time, firstDateStr);
    // Represent end boundary as end hour + 1h (or exact hour label if 1 hour)
    const endDate = new Date(endPt.time);
    let endLabel = formatDayHour(endPt.time, firstDateStr);
    if (!Number.isNaN(endDate.getTime())) {
      const plusOne = new Date(endDate.getTime() + 3600_000);
      const pIso = `${plusOne.getFullYear()}-${String(plusOne.getMonth() + 1).padStart(2, '0')}-${String(
        plusOne.getDate()
      ).padStart(2, '0')}T${String(plusOne.getHours()).padStart(2, '0')}:00`;
      endLabel = formatDayHour(pIso, firstDateStr);
    }

    windows.push({
      startTime: startPt.time,
      endTime: endPt.time,
      label: `${startLabel}–${endLabel}`,
      minAqi: Math.min(...aqis),
      maxAqi: Math.max(...aqis),
      hours: active.length,
    });
    active = [];
  };

  for (const pt of hourlyPoints) {
    if (pt.aqi !== null && Number.isFinite(pt.aqi) && pt.aqi <= maxThreshold) {
      active.push(pt);
    } else {
      flush();
    }
  }
  flush();

  return windows;
}

export function summarizeHourlyTrend(hourly: HourlyDataPoint[]): HourlyTrendSummary {
  const next24Chrono = hourly.slice(0, 24);
  const next24 = next24Chrono.filter((h) => h.aqi !== null && Number.isFinite(h.aqi));

  if (next24.length === 0) {
    return {
      hasHourlyData: false,
      minAqi: null,
      maxAqi: null,
      bestHourLabel: null,
      bestHourAqi: null,
      worstHourLabel: null,
      worstHourAqi: null,
      hasGoodOrSatisfactoryWindow: false,
      cleanWindowRange: null,
      contiguousCleanWindows: [],
      forecastUncertaintyNote:
        'Hourly model trend data is unavailable; recommendations reflect general precaution.',
      bucketAverages: { morning: null, afternoon: null, evening: null, night: null },
    };
  }

  const firstDateStr = next24[0].time.slice(0, 10);
  let best = next24[0];
  let worst = next24[0];
  const buckets = {
    morning: [] as number[],
    afternoon: [] as number[],
    evening: [] as number[],
    night: [] as number[],
  };

  for (const pt of next24) {
    const val = pt.aqi!;
    if (val < best.aqi!) best = pt;
    if (val > worst.aqi!) worst = pt;

    const hr = new Date(pt.time).getHours();
    if (hr >= 6 && hr < 10) buckets.morning.push(val);
    else if (hr >= 10 && hr < 16) buckets.afternoon.push(val);
    else if (hr >= 16 && hr < 21) buckets.evening.push(val);
    else buckets.night.push(val);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;

  const contiguousCleanWindows = findContiguousCleanWindows(next24Chrono, 100);
  // Pick the longest (tie-break: lowest minAqi) contiguous clean window
  const bestCleanWindow =
    contiguousCleanWindows.length > 0
      ? [...contiguousCleanWindows].sort((a, b) => b.hours - a.hours || a.minAqi - b.minAqi)[0]
      : null;

  const spread = worst.aqi! - best.aqi!;
  const forecastUncertaintyNote =
    spread >= 60
      ? `Model forecast varies substantially (${best.aqi}–${worst.aqi} est. AQI over 24h); re-check readings before heading out.`
      : `Model forecast spans ${best.aqi}–${worst.aqi} est. AQI over 24h; local street-level pollution near traffic may be higher than grid estimates.`;

  return {
    hasHourlyData: true,
    minAqi: best.aqi!,
    maxAqi: worst.aqi!,
    bestHourLabel: formatDayHour(best.time, firstDateStr),
    bestHourAqi: best.aqi!,
    worstHourLabel: formatDayHour(worst.time, firstDateStr),
    worstHourAqi: worst.aqi!,
    hasGoodOrSatisfactoryWindow: contiguousCleanWindows.length > 0,
    cleanWindowRange: bestCleanWindow ? bestCleanWindow.label : null,
    contiguousCleanWindows,
    forecastUncertaintyNote,
    bucketAverages: {
      morning: avg(buckets.morning),
      afternoon: avg(buckets.afternoon),
      evening: avg(buckets.evening),
      night: avg(buckets.night),
    },
  };
}

export function generateDynamicDailyPlan(params: {
  aqi: AQIInfo | null;
  pollutants?: Pollutants;
  hourly: HourlyDataPoint[];
  preferences: UserPreferences;
}): DailyRoutineItem[] {
  const { aqi, pollutants, hourly, preferences } = params;
  const trend = summarizeHourlyTrend(hourly);
  const category: AQICategory = aqi?.category ?? 'Unknown';
  const currentAqi = aqi?.value ?? null;

  const hasChildren = preferences.familyMembers.includes('children');
  const hasElderly = preferences.familyMembers.includes('elderly');
  const hasRespiratory = preferences.familyMembers.includes('respiratory');
  const hasVulnerable = hasChildren || hasElderly || hasRespiratory;

  const isGoodOrSatisfactory = category === 'Good' || category === 'Satisfactory';
  const isModerate = category === 'Moderate';
  const isPoorOrWorse =
    category === 'Poor' || category === 'Very Poor' || category === 'Severe' || category === 'Hazardous';
  const isVeryPoorOrSevere =
    category === 'Very Poor' || category === 'Severe' || category === 'Hazardous';

  const bucketText = (val: number | null) =>
    val !== null ? `Model estimate ~${val} AQI` : 'Hourly bucket estimate unavailable';

  // 1. Morning routine (derived from morning hourly bucket, never assuming morning is cleaner)
  const morningBucket = trend.bucketAverages.morning;
  const morningElevated =
    (morningBucket !== null && morningBucket > 100) || isPoorOrWorse || (isModerate && hasVulnerable);

  const morningItem: DailyRoutineItem = {
    timeOfDay: 'morning',
    timeLabel: 'Morning (06:00–10:00)',
    icon: '☀️',
    action:
      currentAqi === null
        ? 'Check pollutant concentrations before opening windows or exercising outdoors'
        : isGoodOrSatisfactory && !morningElevated
        ? 'Normal morning routine; light ventilation if outdoor conditions feel clear'
        : morningElevated
        ? 'Keep windows closed during morning hours and keep activities indoors'
        : 'Keep morning outdoor activity brief and low-intensity',
    when: `06:00–10:00 · ${bucketText(morningBucket)}`,
    why:
      morningBucket !== null && morningBucket > 200
        ? `Morning hourly model estimates reach ~${morningBucket} AQI (Poor or worse), often aggravated by thermal inversions and rush-hour traffic.`
        : morningBucket !== null && morningBucket > 100
        ? `Morning hourly model estimates are ~${morningBucket} AQI (Moderate); prolonged exertion may affect sensitive groups.`
        : currentAqi === null
        ? 'Estimated Indian AQI could not be computed due to incomplete averaging data; avoid assuming morning air is clean.'
        : `Morning hourly model estimates average ~${morningBucket ?? currentAqi} AQI (${category}), which is generally suitable for normal routines.`,
    howItHelps: morningElevated
      ? 'Avoids breathing elevated morning particulate levels during inversion or peak traffic hours.'
      : 'Aligns outdoor activity with model-estimated lower-pollution periods while monitoring changes.',
    alternative: preferences.hasAirPurifier
      ? 'Run your HEPA air purifier on medium/auto with doors and windows closed if outdoor air appears hazy.'
      : 'Choose indoor stretching or breathing space away from street-facing windows.',
    completed: false,
  };

  // 2. Commute routine
  const commutePreference = preferences.transportMode;
  const commuteItem: DailyRoutineItem = {
    timeOfDay: 'commute',
    timeLabel: 'School & Office Commute',
    icon: '🚌',
    action: isVeryPoorOrSevere
      ? 'Use enclosed public transit (metro/AC bus) or work remotely if feasible; use a well-fitted N95/FFP2 mask outdoors'
      : commutePreference === 'private-car'
      ? 'Switch to metro/bus or carpool if practical; avoid congested corridors'
      : 'Prefer metro/bus or low-traffic side streets; avoid active cycling along heavy traffic if AQI > 100',
    when: `Peak commute hours · ${trend.forecastUncertaintyNote}`,
    why: isPoorOrWorse
      ? `Current estimated AQI is ${currentAqi ?? 'elevated'} (${category}). Roadside NO₂ and PM2.5 are typically higher than regional model averages.`
      : isModerate
      ? `At Moderate AQI (${currentAqi}), sensitive commuters and children benefit from minimizing roadside exhaust exposure.`
      : 'Shifting trips from single-occupancy cars reduces both personal traffic exhaust inhalation and community NO₂/PM2.5 emissions.',
    howItHelps:
      'Lower-emission transit reduces tailpipe particulates and NO₂ in urban corridors; enclosed transit cuts direct roadside exposure.',
    alternative:
      commutePreference === 'private-car'
        ? 'If driving is essential, keep windows closed and switch HVAC to recirculate mode while in traffic.'
        : 'For unavoidable short walks in Poor+ air, choose quieter lanes away from arterial roads.',
    completed: false,
  };

  // 3. Outdoor exercise — strictly data-driven from contiguous chronological hourly forecast
  let exerciseAction: string;
  let exerciseWhen: string;
  let exerciseWhy: string;
  let exerciseAlternative: string;

  if (currentAqi === null && !trend.hasHourlyData) {
    exerciseAction = 'Prefer indoor exercise until complete AQI data is available';
    exerciseWhen = 'Anytime indoors (hourly trend unavailable)';
    exerciseWhy =
      'Estimated Indian AQI and hourly trend data are currently incomplete. Avoid intense outdoor exertion without verified air quality conditions.';
    exerciseAlternative =
      pollutants?.pm25 !== null && pollutants?.pm25 !== undefined
        ? `Current PM2.5 estimate is ${pollutants.pm25.toFixed(1)} µg/m³; opt for light indoor mobility instead.`
        : 'Do indoor yoga, bodyweight exercises, or stationary cycling.';
  } else if (isPoorOrWorse && !trend.hasGoodOrSatisfactoryWindow) {
    exerciseAction = 'No suitable outdoor exercise window — move all workouts indoors';
    exerciseWhen = `Indoor workout recommended all day (24h model min: ${trend.minAqi ?? currentAqi} AQI)`;
    exerciseWhy = `All forecast hours remain above Satisfactory (>100 AQI; peak ~${trend.maxAqi ?? currentAqi}). Exercising outdoors increases ventilation rate and inhaled particle dose.`;
    exerciseAlternative = preferences.hasAirPurifier
      ? 'Exercise indoors in a closed room with your HEPA purifier running.'
      : 'Perform low-dust indoor bodyweight training, yoga, or stretching indoors.';
  } else if (isModerate && !trend.hasGoodOrSatisfactoryWindow) {
    exerciseAction = hasVulnerable
      ? 'Keep outdoor exercise indoors for children, elderly, and respiratory-sensitive members'
      : 'Reduce intensity and duration if exercising outdoors; prefer indoor workouts';
    exerciseWhen = trend.bestHourLabel
      ? `Lowest model-estimated hour: ${trend.bestHourLabel} (~${trend.bestHourAqi} AQI), or stay indoors`
      : 'Prefer indoor exercise today';
    exerciseWhy = `Moderate AQI (${currentAqi ?? '101–200'}) does not drop into Good/Satisfactory in the 24h model forecast. Official Indian AQI guidance advises reducing prolonged or strenuous outdoor exertion.`;
    exerciseAlternative = 'Swap high-intensity running for a shorter low-exertion walk or indoor workout.';
  } else if (trend.hasGoodOrSatisfactoryWindow && trend.cleanWindowRange) {
    exerciseAction =
      hasVulnerable && !isGoodOrSatisfactory
        ? `Light outdoor activity only during ${trend.cleanWindowRange}; monitor for any discomfort`
        : `Best model-estimated outdoor window: ${trend.cleanWindowRange}`;
    exerciseWhen = `${trend.cleanWindowRange} (model est. ≤100 AQI; lowest near ${trend.bestHourLabel ?? 'window'} at ~${trend.bestHourAqi})`;
    exerciseWhy = isGoodOrSatisfactory
      ? `Air quality is ${category} (${currentAqi} est. AQI), generally suitable for normal outdoor activity subject to individual sensitivity.`
      : `Although current AQI is ${category}, the hourly model indicates a contiguous lower-pollution window (${trend.cleanWindowRange}) before levels rise toward ~${trend.worstHourAqi}.`;
    exerciseAlternative = 'Move indoors immediately if local haze, smoke, or breathing discomfort occurs.';
  } else {
    exerciseAction = 'Normal outdoor activity is generally suitable; listen to your body';
    exerciseWhen = 'Flexible based on hourly comfort';
    exerciseWhy = `Air quality is ${category} (${currentAqi ?? '--'} est. AQI), within Good/Satisfactory Indian AQI guidance.`;
    exerciseAlternative = 'Choose green spaces away from busy roads for cleaner breathing.';
  }

  const exerciseItem: DailyRoutineItem = {
    timeOfDay: 'outdoor-exercise',
    timeLabel: 'Outdoor Exercise Window',
    icon: '🏃',
    action: exerciseAction,
    when: exerciseWhen,
    why: exerciseWhy,
    howItHelps:
      'Matching exertion to actual hourly AQI levels prevents inhaling excess fine particulates during high-ventilation exercise.',
    alternative: exerciseAlternative,
    completed: false,
  };

  // 4. Afternoon errands
  const afternoonBucket = trend.bucketAverages.afternoon;
  const afternoonCleanerThanMorning =
    afternoonBucket !== null && morningBucket !== null && afternoonBucket < morningBucket - 15;

  const afternoonItem: DailyRoutineItem = {
    timeOfDay: 'afternoon',
    timeLabel: 'Afternoon Errands (10:00–16:00)',
    icon: '🛒',
    action:
      afternoonCleanerThanMorning && afternoonBucket! <= 150
        ? 'Batch errands in the afternoon when model AQI is lower than morning; combine trips'
        : isPoorOrWorse
        ? 'Postpone non-essential outdoor errands or consolidate into one low-exposure trip'
        : 'Combine errands into a single planned trip to minimize road time',
    when: `10:00–16:00 · ${bucketText(afternoonBucket)}`,
    why: afternoonCleanerThanMorning
      ? `Hourly model estimates drop to ~${afternoonBucket} AQI in the afternoon compared to ~${morningBucket} in the morning due to daytime atmospheric mixing.`
      : isPoorOrWorse
      ? `Afternoon model estimates remain elevated (~${afternoonBucket ?? currentAqi} AQI). Consolidating trips limits both personal exposure and vehicle emissions.`
      : 'Batching errands reduces cold-start vehicle emissions and total distance driven.',
    howItHelps:
      'Reduces unnecessary vehicle kilometers and limits time spent near urban traffic corridors.',
    alternative: 'Use shared errands, walking for very short trips when AQI ≤ 100, or consolidated deliveries.',
    completed: false,
  };

  // 5. Evening activities
  const eveningBucket = trend.bucketAverages.evening;
  const eveningElevated =
    (eveningBucket !== null && eveningBucket > 100) || isPoorOrWorse || (isModerate && hasVulnerable);

  const eveningItem: DailyRoutineItem = {
    timeOfDay: 'evening',
    timeLabel: 'Evening Activities (16:00–21:00)',
    icon: '🌆',
    action: eveningElevated
      ? hasVulnerable
        ? 'Keep children, elderly, and sensitive members indoors during evening hours'
        : 'Prefer indoor evening activities and avoid lingering near busy roads'
      : 'Outdoor evening activities are generally suitable; prefer parks away from arterial traffic',
    when: `16:00–21:00 · ${bucketText(eveningBucket)}`,
    why:
      eveningBucket !== null && eveningBucket > 100
        ? `Evening model estimates are ~${eveningBucket} AQI. Combined with evening traffic, roadside exposure rises sharply.`
        : isModerate || isPoorOrWorse
        ? `With ${category} conditions${hasVulnerable ? ' and sensitive household members' : ''}, evening outdoor exertion should be scaled back.`
        : `Evening model estimates remain favorable (~${eveningBucket ?? currentAqi} AQI).`,
    howItHelps:
      'Protects developing lungs in children and lowers respiratory strain in older adults during evening commute peaks.',
    alternative: 'Plan indoor family games, reading, or calm indoor recreation.',
    completed: false,
  };

  // 6. Nighttime indoor routine
  const nightBucket = trend.bucketAverages.night;
  const nightClean = nightBucket !== null && nightBucket <= 100 && !isPoorOrWorse;

  const nightItem: DailyRoutineItem = {
    timeOfDay: 'night',
    timeLabel: 'Nighttime Indoor Routine (21:00+)',
    icon: '🌙',
    action: nightClean
      ? 'Briefly ventilate sleeping areas if outdoor air feels clean, then keep indoor dust sources low'
      : 'Keep bedroom windows sealed, avoid indoor smoke/incense, and run HEPA filtration if available',
    when: `21:00 onwards · ${bucketText(nightBucket)}`,
    why: nightClean
      ? `Nighttime hourly model estimates are ~${nightBucket} AQI (≤100), making brief ventilation reasonable unless local smoke is present.`
      : `Nighttime estimates remain ${nightBucket !== null ? `~${nightBucket} AQI` : 'uncertain/elevated'}. Overnight cooling often traps pollutants near ground level rather than clearing them.`,
    howItHelps:
      'Maintains a cleaner sleeping environment and minimizes overnight PM2.5 infiltration.',
    alternative: preferences.hasAirPurifier
      ? 'Run your HEPA air purifier in the bedroom on sleep/low-noise mode with the door closed.'
      : 'Use damp wiping before bed, seal obvious window gaps, and avoid burning incense or mosquito coils indoors.',
    completed: false,
  };

  return [morningItem, commuteItem, exerciseItem, afternoonItem, eveningItem, nightItem];
}
