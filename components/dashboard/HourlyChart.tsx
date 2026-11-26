'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { HourlyDataPoint } from '@/types';

function formatHourLabel(isoTime: string): string {
  try {
    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
      return isoTime.slice(11, 16) || isoTime;
    }
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return isoTime.slice(11, 16) || isoTime;
  }
}

interface HourlyChartProps {
  data: HourlyDataPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload?: { pm25?: number | null } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const pm25 = payload[0]?.payload?.pm25;
  return (
    <div className="bg-slate-800/95 border border-slate-600/60 rounded-xl p-3 text-xs shadow-xl">
      <div className="text-slate-300 mb-1.5 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="text-slate-300">
            Est. Indian AQI: <span className="font-bold text-white">{Math.round(p.value)}</span>
          </span>
        </div>
      ))}
      {typeof pm25 === 'number' && (
        <div className="text-slate-300 mt-1">
          Hourly PM2.5: <span className="font-semibold text-teal-300">{pm25.toFixed(1)} µg/m³</span>
        </div>
      )}
    </div>
  );
}

export function HourlyChart({ data }: HourlyChartProps) {
  const chartData = data
    .filter((d) => d.aqi !== null)
    .slice(0, 24)
    .map((d) => ({
      time: formatHourLabel(d.time),
      aqi: d.aqi,
      pm25: d.pm25,
    }));

  if (chartData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-5 h-full flex flex-col justify-center items-center text-center">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">24-Hour Estimated AQI Trend</h2>
        <p className="text-xs text-slate-400">
          Hourly CPCB AQI trend is unavailable due to incomplete rolling averaging windows.
        </p>
      </div>
    );
  }

  const maxAQI = Math.max(...chartData.map((d) => d.aqi ?? 0), 50);
  const yMax = Math.ceil(maxAQI / 50) * 50 + 50;

  return (
    <div className="glass-card rounded-2xl p-5 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h2 className="text-sm font-semibold text-slate-200">24-Hour Estimated Indian AQI Trend</h2>
        <span className="text-xs text-slate-400">Rolling model forecast · CPCB methodology</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(20, 184, 166, 0.35)', strokeWidth: 1 }}
          />
          <ReferenceLine y={100} stroke="#76FF03" strokeDasharray="3 3" strokeWidth={0.6} />
          <ReferenceLine y={200} stroke="#FFAB00" strokeDasharray="3 3" strokeWidth={0.6} />
          <ReferenceLine y={300} stroke="#FF6D00" strokeDasharray="3 3" strokeWidth={0.6} />
          <Line
            type="monotone"
            dataKey="aqi"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#14b8a6', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
