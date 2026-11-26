'use client';

import React from 'react';
import type { WeatherData } from '@/types';
import { Thermometer, Droplets, Wind } from 'lucide-react';
import { windDirectionLabel, weatherCodeToDescription } from '@/lib/utils';

interface WeatherCardProps {
  weather: WeatherData;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const { temperature, humidity, windSpeed, windDirection, weatherCode } = weather;
  const hasWeather = temperature !== null || humidity !== null || windSpeed !== null;

  return (
    <div className="glass-card rounded-2xl p-5 h-full">
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
        Weather Conditions
      </h2>

      {weatherCode !== null && (
        <p className="text-sm text-slate-200 mb-4">
          {weatherCodeToDescription(weatherCode)}
        </p>
      )}

      <div className="space-y-3">
        {temperature !== null && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Thermometer className="w-4 h-4 text-orange-300" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Temperature</div>
              <div className="text-sm font-semibold text-white">{temperature}°C</div>
            </div>
          </div>
        )}

        {humidity !== null && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Humidity</div>
              <div className="text-sm font-semibold text-white">{humidity}%</div>
            </div>
          </div>
        )}

        {windSpeed !== null && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Wind className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Wind</div>
              <div className="text-sm font-semibold text-white">
                {windSpeed} km/h
                {windDirection !== null && ` ${windDirectionLabel(windDirection)}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {!hasWeather && (
        <p className="text-sm text-slate-400 italic">Weather data unavailable</p>
      )}
    </div>
  );
}
