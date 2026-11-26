'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { POPULAR_CITIES } from '@/lib/geocoding';
import type { Location } from '@/types';

export function LocationSearch() {
  const { setLocation, detectCurrentLocation, gettingLocation } = useAirQuality();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults(POPULAR_CITIES.slice(0, 5));
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
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          onFocus={() => {
            setOpen(true);
            if (!query) setResults(POPULAR_CITIES.slice(0, 5));
          }}
          placeholder="Search city..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/40 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
          aria-label="Search for a city"
          aria-expanded={open}
          aria-controls="city-search-listbox"
          aria-haspopup="listbox"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400 animate-spin" />
        )}
      </div>

      {open && (
        <div
          id="city-search-listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-slate-800/95 backdrop-blur-md border border-slate-700/40 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto"
          role="listbox"
          aria-label="City search results"
        >
          {/* Current location */}
          <button
            onClick={() => {
              detectCurrentLocation();
              setOpen(false);
            }}
            disabled={gettingLocation}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-teal-300 hover:bg-slate-700/50 transition-colors border-b border-slate-700/30"
          >
            {gettingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            {gettingLocation ? 'Getting location...' : 'Use my current location'}
          </button>

          {results.length > 0 ? (
            results.map((loc, i) => (
              <button
                key={i}
                onClick={() => selectLocation(loc)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-700/50 transition-colors text-left"
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
      )}
    </div>
  );
}
