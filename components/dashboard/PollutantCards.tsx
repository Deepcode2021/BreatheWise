'use client';

import React from 'react';
import type { AQIAvailability, PollutantKey, Pollutants } from '@/types';
import { getPollutantStatus } from '@/lib/aqi';

interface PollutantMeta {
  label: string;
  key: PollutantKey;
  unit: string;
  description: string;
  benchmark: string;
  averagingPeriod: '24h avg' | '8h avg';
}

const POLLUTANT_CONFIG: PollutantMeta[] = [
  {
    label: 'PM2.5',
    key: 'pm25',
    unit: 'µg/m³',
    description: 'Fine particles <2.5µm. Penetrate deep into lungs and bloodstream.',
    benchmark: '60',
    averagingPeriod: '24h avg',
  },
  {
    label: 'PM10',
    key: 'pm10',
    unit: 'µg/m³',
    description: 'Coarse particles <10µm. Cause respiratory and airway irritation.',
    benchmark: '100',
    averagingPeriod: '24h avg',
  },
  {
    label: 'NO₂',
    key: 'no2',
    unit: 'µg/m³',
    description: 'Nitrogen dioxide from vehicles and industry. Irritates airways.',
    benchmark: '80',
    averagingPeriod: '24h avg',
  },
  {
    label: 'SO₂',
    key: 'so2',
    unit: 'µg/m³',
    description: 'Sulphur dioxide from fuel and coal burning. Can trigger asthma.',
    benchmark: '80',
    averagingPeriod: '24h avg',
  },
  {
    label: 'CO',
    key: 'co',
    unit: 'µg/m³',
    description: 'Carbon monoxide from incomplete combustion. Reduces blood oxygen.',
    benchmark: '2000',
    averagingPeriod: '8h avg',
  },
  {
    label: 'O₃',
    key: 'o3',
    unit: 'µg/m³',
    description: 'Ground-level ozone. Irritates lungs, worsens on sunny days.',
    benchmark: '100',
    averagingPeriod: '8h avg',
  },
];

interface PollutantCardProps {
  meta: PollutantMeta;
  avgValue: number | null;
  instantValue: number | null;
  validHours?: number;
  requiredHours?: number;
  windowHours?: number;
  isSufficient?: boolean;
  subIndex?: number | null;
}

function PollutantCard({
  meta,
  avgValue,
  instantValue,
  validHours,
  requiredHours,
  windowHours,
  isSufficient,
  subIndex,
}: PollutantCardProps) {
  // Only compare against the 24h/8h CPCB NAAQS benchmark when a sufficient 24h/8h average exists
  const validAvg =
    avgValue !== null && Number.isFinite(avgValue) && (isSufficient ?? true) ? avgValue : null;
  const displayValue = validAvg !== null ? validAvg : instantValue;

  const status = validAvg !== null ? getPollutantStatus(meta.key, validAvg) : null;
  const statusColors = {
    below_benchmark: { text: '#00C853', bg: '#00C85315', label: 'Below CPCB Std' },
    moderate: { text: '#FFAB00', bg: '#FFAB0015', label: 'Satisfactory' },
    above_benchmark: { text: '#FF6D00', bg: '#FF6D0015', label: 'Above CPCB Std' },
  };
  const sc = status ? statusColors[status] : null;
  const benchmarkScale =
    validAvg !== null ? Math.min((validAvg / Number.parseFloat(meta.benchmark)) * 0.5, 1) : 0;

  return (
    <div className="glass-card rounded-xl p-4 hover:border-slate-500/40 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {meta.label}
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {displayValue !== null ? displayValue.toFixed(1) : '--'}
              <span className="text-xs font-normal text-slate-300 ml-1">{meta.unit}</span>
            </div>
          </div>
          {sc ? (
            <div
              className="text-[11px] font-semibold px-2 py-1 rounded-lg text-right"
              style={{ color: sc.text, backgroundColor: sc.bg }}
            >
              {sc.label}
            </div>
          ) : (
            <div className="text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
              {displayValue !== null ? 'Hourly Only' : 'No Data'}
            </div>
          )}
        </div>

        {/* Averaging context */}
        <div className="text-[11px] text-slate-300 mb-2.5 flex flex-wrap items-center justify-between gap-1">
          <span>
            {validAvg !== null
              ? `${meta.averagingPeriod} (${validHours ?? windowHours}/${windowHours}h)`
              : displayValue !== null
              ? `Current hour est. (${validHours ?? 0}/${requiredHours ?? windowHours}h min)`
              : 'Averaging data unavailable'}
          </span>
          {subIndex !== null && subIndex !== undefined && (
            <span className="text-teal-300 font-medium">Sub-idx: {subIndex}</span>
          )}
        </div>

        {/* Progress bar — only shown for like-for-like averaged benchmark comparisons */}
        {validAvg !== null && sc && (
          <div className="mb-3">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full w-full rounded-full origin-left transition-transform duration-500"
                style={{
                  transform: `scaleX(${benchmarkScale})`,
                  backgroundColor: sc.text,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-slate-300/90 leading-relaxed">{meta.description}</p>
        <p className="text-[11px] text-slate-400 mt-1.5">
          CPCB NAAQS benchmark: {meta.benchmark} {meta.unit} ({meta.averagingPeriod})
        </p>
        {validAvg !== null && instantValue !== null && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            Current hour model value: {instantValue.toFixed(1)} {meta.unit}
          </p>
        )}
      </div>
    </div>
  );
}

interface PollutantCardsProps {
  pollutants: Pollutants;
  instantPollutants?: Pollutants;
  availability?: AQIAvailability;
}

export function PollutantCards({ pollutants, instantPollutants, availability }: PollutantCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {POLLUTANT_CONFIG.map((meta) => {
        const info = availability?.perPollutant?.[meta.key];
        return (
          <PollutantCard
            key={meta.key}
            meta={meta}
            avgValue={info ? info.average : pollutants[meta.key]}
            instantValue={info ? info.instant : (instantPollutants?.[meta.key] ?? null)}
            validHours={info?.validHours}
            requiredHours={info?.requiredHours}
            windowHours={info?.windowHours}
            isSufficient={info?.isSufficient}
            subIndex={info?.subIndex}
          />
        );
      })}
    </div>
  );
}
