'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import type { Location } from '@/types';

const LocationSearchDropdown = dynamic(
  () => import('./LocationSearchDropdown').then((mod) => mod.LocationSearchDropdown),
  { ssr: false }
);

export function LocationSearch() {
  const { setLocation, detectCurrentLocation, gettingLocation } = useAirQuality();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectLocation = (loc: Location) => {
    setLocation(loc);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search city..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/40 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
          aria-label="Search for a city"
          aria-expanded={open}
          aria-controls="city-search-listbox"
          aria-haspopup="listbox"
        />
      </div>

      {open && (
        <LocationSearchDropdown
          query={query}
          gettingLocation={gettingLocation}
          onDetectLocation={detectCurrentLocation}
          onSelectLocation={selectLocation}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
