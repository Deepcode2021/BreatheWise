'use client';

import React from 'react';
import type { AirQualityData } from '@/types';
import { Database, AlertCircle, Clock } from 'lucide-react';
import { formatRelativeTime, isTimestampStale } from '@/lib/utils';

interface DataSourceBadgeProps {
  data: AirQualityData;
}

export function DataSourceBadge({ data }: DataSourceBadgeProps) {
  const { source, sourceLabel, isDemo, timestamp } = data;
  const stale = !isDemo && isTimestampStale(timestamp, 120);

  const styles = {
    OpenMeteo_Model: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/25',
      text: 'text-blue-200',
      dot: 'bg-blue-400',
    },
    OpenAQ_Station: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/25',
      text: 'text-green-200',
      dot: 'bg-green-400',
    },
    CPCB_Official: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      text: 'text-emerald-200',
      dot: 'bg-emerald-400',
    },
    Demo: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      text: 'text-amber-200',
      dot: 'bg-amber-400',
    },
  };

  const style = styles[source] ?? styles.Demo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${style.bg} ${style.border} ${style.text}`}
      >
        {isDemo ? (
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
        )}
        <Database className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">{sourceLabel}</span>
      </div>

      {timestamp && (
        <div
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${
            stale
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-slate-800/60 border-slate-700/40 text-slate-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {stale
              ? `Stale data (${formatRelativeTime(timestamp)}) — Refresh recommended`
              : `Freshness: ${formatRelativeTime(timestamp)}`}
          </span>
        </div>
      )}
    </div>
  );
}
