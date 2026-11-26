'use client';

import React, { useState, useMemo } from 'react';
import { Home, Bed, Utensils, Baby, Monitor, ChevronRight, Info, Wind } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { summarizeHourlyTrend } from '@/lib/dailyPlan';
import type { Room, IndoorTip } from '@/types';
import { cn } from '@/lib/utils';

const ROOMS: Array<{ id: Room; label: string; icon: React.ElementType; color: string }> = [
  { id: 'bedroom', label: 'Bedroom', icon: Bed, color: '#6366f1' },
  { id: 'living-room', label: 'Living Room', icon: Home, color: '#14b8a6' },
  { id: 'kitchen', label: 'Kitchen', icon: Utensils, color: '#f59e0b' },
  { id: 'children-room', label: "Children's Room", icon: Baby, color: '#ec4899' },
  { id: 'home-office', label: 'Home Office', icon: Monitor, color: '#a78bfa' },
];

const INDOOR_TIPS: IndoorTip[] = [
  {
    id: '1',
    title: 'Use damp mopping instead of dry sweeping',
    description: 'Wet mopping or microfiber damp wiping captures settled dust instead of kicking it back into indoor air.',
    why: 'Dry sweeping and dry dusting resuspend fine particles that can remain airborne and be inhaled.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office'],
    priority: 'high',
  },
  {
    id: '2',
    title: 'Clean air conditioner and purifier filters regularly',
    description: 'Inspect, clean, or replace pre-filters and HEPA cartridges according to the manufacturer schedule.',
    why: 'Clogged filters restrict airflow, lower Clean Air Delivery Rate (CADR), and reduce filtration performance.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office', 'kitchen'],
    priority: 'high',
  },
  {
    id: '3',
    title: 'Use an appropriately sized HEPA air purifier where feasible',
    description: 'Place a true HEPA purifier in occupied rooms and keep doors/windows closed during high outdoor pollution.',
    why: 'Real-world effectiveness depends on CADR, room size and ceiling height, filter condition, indoor air circulation (keep intake/exhaust unobstructed), and outdoor air infiltration through gaps or open windows.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office'],
    priority: 'high',
  },
  {
    id: '4',
    title: 'Keep windows closed when outdoor air quality is elevated',
    description: 'Check outdoor AQI trends before opening windows; keep frames sealed during Poor, Very Poor, or Severe conditions.',
    why: 'Unfiltered outdoor air infiltration quickly raises indoor PM2.5 when outdoor pollution is high.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office', 'kitchen'],
    priority: 'high',
  },
  {
    id: '5',
    title: 'Ventilate only during cleaner outdoor periods',
    description: 'Cross-ventilate briefly only when outdoor AQI trends indicate cleaner air (typically Good or Satisfactory, <=100 AQI) and no local smoke is present.',
    why: 'Fresh air exchange helps dilute indoor CO2 and cooking/cleaning VOCs, but timing must follow actual outdoor conditions rather than fixed clock assumptions.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office', 'kitchen'],
    priority: 'medium',
  },
  {
    id: '6',
    title: 'Avoid indoor smoking, incense, and unnecessary combustion',
    description: 'Avoid indoor cigarette smoke, incense sticks (agarbatti), dhoop, candles, and open-flame mosquito coils.',
    why: 'Indoor combustion directly releases concentrated fine particulate matter and irritating gases in enclosed spaces.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office'],
    priority: 'high',
  },
  {
    id: '7',
    title: 'Run kitchen exhaust ventilation while cooking',
    description: 'Switch on your range hood or exhaust fan before lighting the stove and keep it running briefly after cooking finishes.',
    why: 'Cooking—especially frying, roasting, and gas combustion—generates PM2.5, NO2, CO, and fumes.',
    rooms: ['kitchen'],
    priority: 'high',
  },
  {
    id: '8',
    title: 'Prefer electric or induction cooking when available',
    description: 'Use induction or electric kettles/cooktops where practical to reduce indoor combustion byproducts.',
    why: 'Unlike gas burners, induction heating does not produce indoor NO2 or CO combustion emissions.',
    rooms: ['kitchen'],
    priority: 'medium',
  },
  {
    id: '9',
    title: 'Set up a low-infiltration sleeping space during severe smog',
    description: 'Keep bedroom doors shut and seal visible window/door gaps with weatherstripping during prolonged pollution episodes.',
    why: 'Minimizing air leakage helps maintain cleaner indoor air overnight when outdoor PM2.5 remains high.',
    rooms: ['bedroom', 'children-room'],
    priority: 'medium',
  },
  {
    id: '10',
    title: 'Choose low-VOC, fragrance-free cleaning products',
    description: 'Use mild soap, water, or low-VOC cleaners instead of heavily scented sprays and aerosolized disinfectants.',
    why: 'Volatile organic compounds (VOCs) and artificial fragrances can irritate airways and react indoors.',
    rooms: ['bedroom', 'living-room', 'children-room', 'kitchen', 'home-office'],
    priority: 'medium',
  },
  {
    id: '11',
    title: 'Leave outdoor footwear at the entrance',
    description: 'Store shoes near the entryway and wash entry mats periodically.',
    why: 'Footwear tracks outdoor settled dust, soil particulates, and road residue onto indoor floors.',
    rooms: ['bedroom', 'living-room', 'children-room'],
    priority: 'medium',
  },
  {
    id: '12',
    title: 'Keep home office surfaces and printers ventilated',
    description: 'Wipe desks with a damp cloth and place laser printers away from your primary breathing zone.',
    why: 'Laser printers and accumulated paper dust can emit fine particles and localized odors during heavy use.',
    rooms: ['home-office'],
    priority: 'low',
  },
  {
    id: '13',
    title: 'Keep houseplants as complementary greenery, not air purifiers',
    description: 'Enjoy indoor plants for comfort while avoiding over-watering that causes mold growth.',
    why: 'In real rooms, houseplants do not remove significant PM2.5 compared with source control and mechanical HEPA filtration.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office'],
    priority: 'low',
  },
  {
    id: '14',
    title: 'Do NOT use ozone-generating air cleaners',
    description: 'Avoid ionizers or air cleaners that intentionally emit ozone.',
    why: 'Ozone is a respiratory irritant that can harm lung tissue and react with indoor chemicals to create secondary pollutants.',
    rooms: ['bedroom', 'living-room', 'children-room', 'home-office', 'kitchen'],
    priority: 'high',
  },
];

const PRIORITY_STYLES = {
  high: { color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Important' },
  medium: { color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Recommended' },
  low: { color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'Helpful' },
};

export default function IndoorGuidePage() {
  const { data, forecast } = useAirQuality();
  const [selectedRoom, setSelectedRoom] = useState<Room>('bedroom');
  const [expandedTip, setExpandedTip] = useState<string | null>('3');

  const roomTips = useMemo(
    () => INDOOR_TIPS.filter((tip) => tip.rooms.includes(selectedRoom)),
    [selectedRoom]
  );
  const roomInfo = useMemo(
    () => ROOMS.find((r) => r.id === selectedRoom),
    [selectedRoom]
  );

  const trend = useMemo(
    () => summarizeHourlyTrend(forecast?.hourly ?? []),
    [forecast?.hourly]
  );
  const currentAqi = data?.aqi?.value ?? null;

  const ventilationAdvice = useMemo(() => {
    if (currentAqi === null && !trend.hasHourlyData) {
      return 'Outdoor AQI is currently incomplete/unavailable. Keep windows closed if air looks hazy or smoky, and rely on exhaust fans and indoor source control.';
    }
    if (currentAqi !== null && currentAqi <= 100) {
      return `Current model estimate is ${currentAqi} AQI (${data?.aqi?.category}). Conditions are generally suitable for brief cross-ventilation unless local smoke or heavy traffic is nearby.`;
    }
    if (trend.hasGoodOrSatisfactoryWindow && trend.cleanWindowRange) {
      return `Current model estimate is ${currentAqi} AQI (${data?.aqi?.category}). Keep windows closed now; hourly model estimates project a cleaner window (${trend.cleanWindowRange}, ≤100 AQI) for brief ventilation if conditions feel clear.`;
    }
    return `Current model estimate is ${currentAqi ?? 'elevated'} AQI (${data?.aqi?.category ?? 'elevated'}) and no hourly window drops to ≤100 AQI in the next 24h forecast. Keep windows closed and rely on source control and HEPA filtration if available.`;
  }, [currentAqi, data?.aqi?.category, trend]);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Home className="w-6 h-6 text-teal-400" />
          Smart Indoor Air Guide
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Practical indoor air quality guidance for every room in your home
        </p>
      </div>

      {/* Guidance vs Measurement Clarification */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-200 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-300" />
        <div>
          <span className="font-semibold">Guidance Only — Not Direct Indoor Measurements: </span>
          BreatheWise provides practical indoor air-quality recommendations based on outdoor conditions and general building-science principles. No indoor air sensors are connected to this app.
        </div>
      </div>

      {/* Dynamic Outdoor-Trend Ventilation Banner */}
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 p-4 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-100 text-sm"
      >
        <Wind className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-300" />
        <div>
          <span className="font-semibold text-teal-300">Current Ventilation Guidance (from outdoor model trends): </span>
          {ventilationAdvice}
        </div>
      </div>

      {/* Warning about ozone generators */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-300" />
        <div>
          <span className="font-semibold">Important Safety Warning: </span>
          Do NOT use ozone-generating air cleaners. They emit ozone — a respiratory irritant — and are advised against by health authorities.
        </div>
      </div>

      {/* Room Selector */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Select a Room</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ROOMS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setSelectedRoom(id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors duration-200',
                selectedRoom === id
                  ? 'border-teal-400/50 bg-slate-800/90'
                  : 'glass-card border-transparent hover:border-slate-500/40'
              )}
              style={
                selectedRoom === id
                  ? { backgroundColor: `${color}22`, borderColor: `${color}55` }
                  : {}
              }
              aria-pressed={selectedRoom === id}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}18` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <span className="text-xs font-medium text-slate-200">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tips for selected room */}
      {roomInfo && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            {roomInfo.label} Recommendations ({roomTips.length})
          </h2>
          <div className="space-y-3">
            {roomTips.map((tip) => {
              const pStyle = PRIORITY_STYLES[tip.priority];
              const isExpanded = expandedTip === tip.id;

              return (
                <div
                  key={tip.id}
                  className="glass-card rounded-xl overflow-hidden transition-colors duration-200"
                >
                  <button
                    onClick={() => setExpandedTip(isExpanded ? null : tip.id)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-700/20 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div
                      className={cn('mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', pStyle.color, pStyle.bg, pStyle.border)}
                    >
                      {pStyle.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{tip.title}</h3>
                      <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">{tip.description}</p>
                    </div>
                    <ChevronRight
                      className={cn('w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
                      <p className="text-sm text-slate-200">{tip.description}</p>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                        <Info className="w-4 h-4 text-teal-300 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-200 leading-relaxed">
                          <span className="font-semibold text-teal-300">Why it matters: </span>
                          {tip.why}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
