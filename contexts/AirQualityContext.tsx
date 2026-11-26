'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { AirQualityData, AirQualityForecast, Location } from '@/types';
import { isValidLocationObject } from '@/lib/validation';

const DEFAULT_LOCATION: Location = {
  name: 'Delhi',
  country: 'India',
  state: 'Delhi',
  coordinates: { latitude: 28.6519, longitude: 77.2315 },
};

interface AirQualityContextValue {
  data: AirQualityData | null;
  forecast: AirQualityForecast | null;
  loading: boolean;
  error: string | null;
  location: Location | null;
  setLocation: (loc: Location) => void;
  refresh: () => void;
  detectCurrentLocation: () => void;
  gettingLocation: boolean;
}

const AirQualityContext = createContext<AirQualityContextValue | null>(null);

export function AirQualityProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<Location | null>(null);
  const [data, setData] = useState<AirQualityData | null>(null);
  const [forecast, setForecast] = useState<AirQualityForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadForLocation = useCallback(async (loc: Location) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({
        lat: loc.coordinates.latitude.toString(),
        lon: loc.coordinates.longitude.toString(),
        name: loc.name,
        country: loc.country,
        ...(loc.state ? { state: loc.state } : {}),
      });

      const res = await fetch(`/api/air-quality?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();

      if (json.error && !json.data) {
        throw new Error(json.error);
      }

      setLocationState(loc);
      setData(json.data);
      setForecast(json.forecast);
      setError(json.error ? 'Live model service unavailable. Showing fallback demo data.' : null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to fetch air quality:', err);
      const { getDemoAirQualityData, getDemoForecast } = await import('@/lib/demoData');
      setLocationState(loc);
      setData(getDemoAirQualityData());
      setForecast(getDemoForecast());
      setError('Could not connect to air quality service. Showing demo data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const setLocation = useCallback(
    (loc: Location) => {
      setLoading(true);
      setError(null);
      setLocationState(loc);
      try {
        localStorage.setItem('breathewise_location', JSON.stringify(loc));
      } catch {}
      void loadForLocation(loc);
    },
    [loadForLocation]
  );

  const refresh = useCallback(() => {
    if (location) {
      setLoading(true);
      setError(null);
      void loadForLocation(location);
    }
  }, [location, loadForLocation]);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const loc: Location = {
          name: 'My Location',
          country: 'India',
          coordinates: { latitude, longitude },
        };
        setGettingLocation(false);
        setLoading(true);
        setError(null);
        setLocationState(loc);
        void loadForLocation(loc);
      },
      (err) => {
        setGettingLocation(false);
        setError(`Location access denied: ${err.message}`);
      },
      { timeout: 10000 }
    );
  }, [loadForLocation]);

  // Initialize with saved location or default Delhi
  useEffect(() => {
    let initialLoc: Location = DEFAULT_LOCATION;
    try {
      const saved = localStorage.getItem('breathewise_location');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isValidLocationObject(parsed)) {
          initialLoc = parsed;
        }
      }
    } catch {}
    const timer = setTimeout(() => {
      void loadForLocation(initialLoc);
    }, 0);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadForLocation]);

  const contextValue = useMemo(
    () => ({
      data,
      forecast,
      loading,
      error,
      location,
      setLocation,
      refresh,
      detectCurrentLocation,
      gettingLocation,
    }),
    [data, forecast, loading, error, location, setLocation, refresh, detectCurrentLocation, gettingLocation]
  );

  return (
    <AirQualityContext.Provider value={contextValue}>
      {children}
    </AirQualityContext.Provider>
  );
}

export function useAirQuality() {
  const ctx = useContext(AirQualityContext);
  if (!ctx) throw new Error('useAirQuality must be used within AirQualityProvider');
  return ctx;
}
