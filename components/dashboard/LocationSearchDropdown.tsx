'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { POPULAR_CITIES } from '@/lib/geocoding';
import type { Location } from '@/types';

interface LocationSearchDropdownProps {
  query: string;
  gettingLocation: boolean;
  onDetectLocation: () => void;
  onSelectLocation: (loc: Location) => void;
  onClose: () => void;
}

export function LocationSearchDropdown({
  query,
  gettingLocation,
  onDetectLocation,
  onSelectLocation,
  onClose,
}: LocationSearchDropdownProps) {
  const [results, setResults] = useState<Location[]>(() => POPULAR_CITIES.slice(0, 5));
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults(POPULAR_CITIES.slice(0, 5));
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div
      id="city-search-listbox"
      className="absolute top-full left-0 right-0 mt-1 bg-slate-800/95 backdrop-blur-md border border-slate-700/40 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto"
      role="listbox"
      aria-label="City search results"
    >
      {/* Current location */}
      <button
        onClick={() => {
          onDetectLocation();
          onClose();
        }}
        disabled={gettingLocation}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-teal-300 hover:bg-slate-700/50 border-b border-slate-700/30"
      >
        {gettingLocation ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4" />
        )}
        {gettingLocation ? 'Getting location...' : 'Use my current location'}
      </button>

      {searching && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-slate-300">
          <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
          <span>Searching cities...</span>
        </div>
      )}

      {results.length > 0 ? (
        results.map((loc, i) => (
          <button
            key={`${loc.name}-${loc.coordinates.latitude}-${i}`}
            onClick={() => onSelectLocation(loc)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-700/50 text-left"
            role="option"
            aria-selected={false}
          >
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <span className="text-slate-100 font-medium">{loc.name}</span>
              {loc.state && <span className="text-slate-400">, {loc.state}</span>}
              <span className="text-slate-400"> — {loc.country}</span>
            </div>
          </button>
        ))
      ) : query.length > 1 && !searching ? (
        <div className="px-4 py-3 text-sm text-slate-400 text-center">No cities found</div>
      ) : null}
    </div>
  );
}
