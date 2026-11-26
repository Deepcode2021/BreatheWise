'use client';

import React from 'react';
import type { AirQualityData } from '@/types';
import { Shield, Clock, Database, AlertTriangle, Info } from 'lucide-react';
import { formatRelativeTime, formatTimestamp, isTimestampStale } from '@/lib/utils';
import { CPCB_METHODOLOGY_LABEL, formatAQIScale } from '@/lib/aqi';

interface AQIStatusCardProps {
  data: AirQualityData;
}

const POLLUTANT_LABELS: Record<string, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  o3: 'O₃',
};

export function AQIStatusCard({ data }: AQIStatusCardProps) {
  const { aqi, aqiAvailability, location, timestamp, sourceLabel, isDemo } = data;
  const stale = !isDemo && isTimestampStale(timestamp, 120);

  return (
    <div
      className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between"
      style={
        aqi
          ? {
              borderColor: `${aqi.color}25`,
              boxShadow: `0 0 40px ${aqi.color}08`,
            }
          : {}
      }
    >
      {/* Top: location + category */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {location.name}
              {location.state ? `, ${location.state}` : ''}
            </h2>
            <p className="text-sm text-slate-300">{location.country}</p>
          </div>
          {aqi ? (
            <div
              className="flex-shrink-0 text-right px-4 py-2 rounded-xl"
              style={{
                backgroundColor: `${aqi.color}15`,
                border: `1px solid ${aqi.color}30`,
              }}
            >
              <div className="text-3xl font-black" style={{ color: aqi.color }}>
                {aqi.value}
              </div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: aqi.color }}>
                {aqi.category}
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 text-right px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-2xl font-bold text-slate-300">--</div>
              <div className="text-xs font-semibold text-amber-300 mt-0.5">Incomplete</div>
            </div>
          )}
        </div>

        {/* Description / Incomplete State */}
        {aqi ? (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-200">{aqi.description}</p>
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl text-sm"
              style={{
                backgroundColor: `${aqi.color}12`,
                borderLeft: `3px solid ${aqi.color}`,
              }}
            >
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: aqi.color }} />
              <span className="text-slate-200">{aqi.healthImplication}</span>
            </div>
            {aqi.dominantPollutant && (
              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                <span>
                  Dominant sub-index:{' '}
                  <strong className="text-teal-300">
                    {POLLUTANT_LABELS[aqi.dominantPollutant] ?? aqi.dominantPollutant}
                  </strong>
                </span>
                {aqi.validPollutantCount !== undefined && (
                  <span>
                    Valid averaged pollutants: <strong className="text-slate-200">{aqi.validPollutantCount}/6</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-200">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
            <div className="space-y-1">
              <p className="font-semibold">Estimated Indian AQI cannot be calculated reliably</p>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {aqiAvailability?.reason ??
                  'CPCB methodology requires at least 3 pollutants with valid 24h (PM2.5, PM10, NO₂, SO₂) or 8h (CO, O₃) averages, including PM2.5 or PM10.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: metadata */}
      <div className="mt-4 pt-4 border-t border-slate-700/40 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Database className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className={isDemo ? 'text-amber-300 font-medium' : 'text-slate-300'}>
            {sourceLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>
            Data timestamp: {formatTimestamp(timestamp)} ({formatRelativeTime(timestamp)})
          </span>
          {stale && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
              Stale (&gt;2h old) — click Refresh
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>
            Methodology: {aqi ? (aqi.methodology ?? formatAQIScale(aqi.scale)) : CPCB_METHODOLOGY_LABEL}
          </span>
        </div>
      </div>
    </div>
  );
}
