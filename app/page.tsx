'use client';

import React from 'react';
import { useAirQuality } from '@/contexts/AirQualityContext';
import { AQIGauge } from '@/components/dashboard/AQIGauge';
import { AQIStatusCard } from '@/components/dashboard/AQIStatusCard';
import { PollutantCards } from '@/components/dashboard/PollutantCards';
import { HourlyChart } from '@/components/dashboard/HourlyChart';
import { ForecastCards } from '@/components/dashboard/ForecastCards';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { LocationSearch } from '@/components/dashboard/LocationSearch';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { AlertTriangle, Info } from 'lucide-react';

export default function DashboardPage() {
  const { data, forecast, loading, error } = useAirQuality();

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Air Quality Dashboard</h1>
          <p className="text-sm text-slate-300 mt-1">
            Model-estimated Indian AQI and pollutant breakdown for your selected location
          </p>
        </div>
        <LocationSearch />
      </div>

      {/* Error/Warning Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Demo Banner */}
      {data?.isDemo && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-200 text-sm">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-300" />
          <div>
            <span className="font-semibold">Demo Mode Active</span> — The values shown are sample data for demonstration purposes only.
            They do not represent actual current air quality. Configure your Gemini API key to enable the AI assistant.
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Data Source & Freshness Badges */}
          <DataSourceBadge data={data} />

          {/* Main AQI Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <AQIGauge aqi={data.aqi} availability={data.aqiAvailability} loading={loading} />
            </div>
            <div className="md:col-span-2">
              <AQIStatusCard data={data} />
            </div>
          </div>

          {/* Pollutant Cards */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Pollutant Breakdown
              </h2>
              <span className="text-xs text-slate-400">
                24h model avg for PM2.5, PM10, NO₂, SO₂ · 8h model avg for CO, O₃
              </span>
            </div>
            <PollutantCards
              pollutants={data.pollutants}
              instantPollutants={data.instantPollutants}
              availability={data.aqiAvailability}
            />
          </div>

          {/* Weather + Hourly Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1">
              <WeatherCard weather={data.weather} />
            </div>
            <div className="lg:col-span-3">
              {forecast?.hourly && forecast.hourly.length > 0 && (
                <HourlyChart data={forecast.hourly} />
              )}
            </div>
          </div>

          {/* 5-Day Forecast */}
          {forecast?.daily && forecast.daily.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                5-Day Forecast (Estimated Indian AQI — Model Estimates)
              </h2>
              <ForecastCards days={forecast.daily} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
