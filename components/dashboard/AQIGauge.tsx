'use client';

import React from 'react';
import type { AQIAvailability, AQIInfo } from '@/types';
import { CPCB_METHODOLOGY_LABEL, formatAQIScale } from '@/lib/aqi';

interface AQIGaugeProps {
  aqi: AQIInfo | null;
  availability?: AQIAvailability;
  loading?: boolean;
}

const POLLUTANT_LABELS: Record<string, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  o3: 'O₃',
};

export function AQIGauge({ aqi, availability, loading }: AQIGaugeProps) {
  const radius = 70;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // half circle

  const maxAQI = 500;
  const value = aqi?.value ?? 0;
  const percentage = aqi ? Math.min(value / maxAQI, 1) : 0;
  const strokeDashoffset = circumference - percentage * circumference;

  const color = aqi?.color ?? '#64748b';

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center h-full">
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
        Estimated AQI Gauge
      </h2>

      {loading && !aqi ? (
        <div className="w-36 h-20 shimmer rounded-full" />
      ) : (
        <>
          <div className="relative">
            <svg
              width={radius * 2}
              height={radius + 10}
              viewBox={`0 0 ${radius * 2} ${radius + 10}`}
              role="img"
              aria-label={aqi ? `Estimated AQI gauge showing ${value} (${aqi.category})` : 'Estimated AQI unavailable due to incomplete averaging data'}
            >
              {/* Background arc */}
              <path
                d={`M ${strokeWidth / 2},${radius} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 - strokeWidth / 2},${radius}`}
                fill="none"
                stroke="rgba(100,116,139,0.25)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d={`M ${strokeWidth / 2},${radius} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 - strokeWidth / 2},${radius}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="aqi-gauge-track"
                style={aqi ? { filter: `drop-shadow(0 0 6px ${color}60)` } : undefined}
              />
            </svg>

            {/* Center value */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
              <div className="text-3xl font-bold leading-none" style={{ color }}>
                {aqi ? value : '--'}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {aqi ? 'Est. AQI' : 'Incomplete'}
              </div>
            </div>
          </div>

          {/* Category */}
          {aqi ? (
            <div
              className="mt-3 text-center px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{
                color: aqi.color,
                backgroundColor: `${aqi.color}18`,
                border: `1px solid ${aqi.color}30`,
              }}
            >
              {aqi.category}
            </div>
          ) : (
            <div className="mt-3 text-center px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Incomplete Averaging Data
            </div>
          )}

          {/* Dominant pollutant */}
          {aqi?.dominantPollutant && (
            <div className="mt-2 text-xs text-slate-300">
              Primary driver: <span className="font-semibold text-teal-300">{POLLUTANT_LABELS[aqi.dominantPollutant] ?? aqi.dominantPollutant}</span>
            </div>
          )}

          {/* Scale / Methodology label */}
          <div className="mt-2 text-center px-2">
            <span className="text-[11px] text-slate-400">
              {aqi ? (aqi.methodology ?? formatAQIScale(aqi.scale)) : CPCB_METHODOLOGY_LABEL}
            </span>
          </div>

          {!aqi && availability?.reason && (
            <p className="mt-2 text-[11px] text-amber-300 text-center leading-snug">
              {availability.validPollutants.length}/3 pollutants met averaging criteria
            </p>
          )}

          {/* AQI scale legend */}
          <div className="mt-4 w-full grid grid-cols-6 gap-0.5" aria-label="CPCB AQI color scale">
            {[
              { color: '#00C853', label: '0–50' },
              { color: '#76FF03', label: '51–100' },
              { color: '#FFAB00', label: '101–200' },
              { color: '#FF6D00', label: '201–300' },
              { color: '#D50000', label: '301–400' },
              { color: '#6A0080', label: '401+' },
            ].map(({ color: c, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  className="w-full h-1.5 rounded-full"
                  style={{ backgroundColor: c }}
                  title={label}
                />
                <span className="text-[10px] text-slate-400">{label.split('–')[0]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
