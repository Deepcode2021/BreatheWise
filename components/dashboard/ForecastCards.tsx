'use client';

import React from 'react';
import type { ForecastDay } from '@/types';
import { getAQICategoryColor } from '@/lib/aqi';

interface ForecastCardsProps {
  days: ForecastDay[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatForecastDate(dateStr: string): string {
  try {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return DATE_FORMATTER.format(parsed);
  } catch {
    return dateStr;
  }
}

export function ForecastCards({ days }: ForecastCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {days.map((day) => {
        const color = getAQICategoryColor(day.category);
        const headlineAqi = day.avgAqi ?? day.maxAqi;
        const date = formatForecastDate(day.date);

        return (
          <div
            key={day.date}
            className="glass-card rounded-xl p-4 text-center hover:border-slate-500/40"
            style={{ borderColor: `${color}25` }}
          >
            <div className="text-xs font-medium text-slate-300 mb-2">{date}</div>
            <div className="text-2xl font-bold mb-1" style={{ color }}>
              {headlineAqi ?? '--'}
            </div>
            <div className="text-xs font-semibold mb-2" style={{ color }}>
              {day.category}
            </div>
            {day.minAqi !== null && day.maxAqi !== null && (
              <div className="text-xs text-slate-400">
                Range: {day.minAqi}–{day.maxAqi}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
