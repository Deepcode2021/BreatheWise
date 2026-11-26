'use client';

import React from 'react';
import { Menu, RefreshCw, MapPin } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { formatRelativeTime, isTimestampStale } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { data, loading, refresh } = useAirQuality();
  const stale = data?.timestamp && !data.isDemo ? isTimestampStale(data.timestamp, 120) : false;

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 backdrop-blur-md border-b border-slate-700/30 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Location display */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <MapPin className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100 truncate">
            {data?.location
              ? `${data.location.name}${data.location.state ? `, ${data.location.state}` : ''}`
              : 'Select a location'}
          </div>
          {data?.timestamp && (
            <div className={cn('text-xs truncate', stale ? 'text-amber-300' : 'text-slate-400')}>
              {stale
                ? `Stale reading (${formatRelativeTime(data.timestamp)})`
                : `Data timestamp ${formatRelativeTime(data.timestamp)}`}
            </div>
          )}
        </div>
      </div>

      {/* AQI Quick Badge */}
      {data?.aqi ? (
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
          style={{
            color: data.aqi.color,
            borderColor: `${data.aqi.color}35`,
            backgroundColor: `${data.aqi.color}15`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: data.aqi.color }}
          />
          Est. AQI {data.aqi.value} · {data.aqi.category}
        </div>
      ) : data && !loading ? (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 text-xs font-medium text-slate-300">
          Est. AQI Unavailable
        </div>
      ) : null}

      {/* Stale badge */}
      {stale && (
        <div className="hidden md:block text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
          STALE DATA
        </div>
      )}

      {/* Demo badge */}
      {data?.isDemo && (
        <div className="hidden sm:block text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25 font-medium">
          DEMO DATA
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={refresh}
        disabled={loading}
        className={cn(
          'p-2 rounded-lg text-slate-300 hover:text-teal-400 hover:bg-slate-800 transition-colors',
          loading && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Refresh air quality data"
        title="Refresh data"
      >
        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
      </button>
    </header>
  );
}
