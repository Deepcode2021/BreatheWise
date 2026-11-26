'use client';

import React from 'react';
import { Settings, User, Shield, Database, Info } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useAirQuality } from '@/contexts/AirQualityContext';
import type { FamilyMember } from '@/types';
import { cn } from '@/lib/utils';

const FAMILY_MEMBER_OPTIONS: Array<{ id: FamilyMember; label: string; description: string; icon: string }> = [
  { id: 'adults', label: 'Adults', description: 'General adult air quality recommendations', icon: '👨' },
  { id: 'children', label: 'Children', description: 'Extra protective guidance for children under 15', icon: '👦' },
  { id: 'elderly', label: 'Elderly', description: 'Conservative precautions for adults 65+', icon: '👴' },
  { id: 'respiratory', label: 'Respiratory Precautions', description: 'Additional caution for those preferring extra protection', icon: '🫁' },
];

const TRANSPORT_OPTIONS = [
  { value: 'private-car', label: 'Private Car', icon: '🚗' },
  { value: 'public-transport', label: 'Public Transport', icon: '🚌' },
  { value: 'cycling', label: 'Cycling / Walking', icon: '🚴' },
  { value: 'mixed', label: 'Mixed', icon: '🔄' },
];

export default function SettingsPage() {
  const { preferences, updatePreferences } = usePreferences();
  const { data } = useAirQuality();

  const toggleFamilyMember = (id: FamilyMember) => {
    const current = preferences.familyMembers;
    const updated = current.includes(id) ? current.filter((m) => m !== id) : [...current, id];
    if (updated.length === 0) return; // at least one must be selected
    updatePreferences({ familyMembers: updated });
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-400" />
          Settings & Preferences
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Personalize BreatheWise to your household, protection preferences, and daily commute
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Family Protection Mode */}
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-semibold text-white">Family Protection Mode</h2>
          </div>
          <p className="text-sm text-slate-300">
            Select who lives in your household to receive tailored clean-air precautions.
          </p>
          <div className="space-y-3">
            {FAMILY_MEMBER_OPTIONS.map(({ id, label, description, icon }) => {
              const selected = preferences.familyMembers.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className={cn(
                    'w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-colors duration-200',
                    selected
                      ? 'border-teal-500/40 bg-teal-500/12'
                      : 'border-slate-700/40 hover:border-slate-500/60'
                  )}
                  onClick={() => toggleFamilyMember(id)}
                >
                  <div className="text-xl flex-shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="text-xs text-slate-300">{description}</div>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      selected ? 'border-teal-400 bg-teal-400' : 'border-slate-500'
                    )}
                  >
                    {selected && (
                      <svg className="w-3 h-3 text-slate-950" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5l1-1 2 2 4-4.5 1 1z" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
            BreatheWise does not provide medical diagnosis. These preferences adjust recommendation caution levels; always consult a qualified healthcare professional for medical advice.
          </div>
        </section>

        {/* Lifestyle Preferences */}
        <section className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-semibold text-white">Lifestyle Preferences</h2>
          </div>

          <div>
            <div className="block text-sm font-medium text-slate-200 mb-2.5">
              Primary Transport Mode
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRANSPORT_OPTIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updatePreferences({ transportMode: value })}
                  aria-pressed={preferences.transportMode === value}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm transition-colors duration-200 text-left',
                    preferences.transportMode === value
                      ? 'border-teal-500/40 bg-teal-500/12 text-teal-200 font-medium'
                      : 'border-slate-700/40 text-slate-300 hover:border-slate-500/60 hover:text-white'
                  )}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/40">
            <button
              type="button"
              role="switch"
              aria-checked={preferences.hasAirPurifier}
              onClick={() => updatePreferences({ hasAirPurifier: !preferences.hasAirPurifier })}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <div>
                <div className="text-sm font-medium text-slate-200">HEPA Air Purifier at Home</div>
                <div className="text-xs text-slate-400">Tailors indoor and daily plan recommendations</div>
              </div>
              <div
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                  preferences.hasAirPurifier ? 'bg-teal-500' : 'bg-slate-700'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                    preferences.hasAirPurifier ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </div>
            </button>
          </div>
        </section>

        {/* Data & API Info */}
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-semibold text-white">Data Sources & Methodology</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-slate-700/40">
              <span className="text-slate-300">Current data source</span>
              <span className="text-slate-100 text-xs">{data?.sourceLabel ?? 'Loading...'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-slate-700/40">
              <span className="text-slate-300">AQI Methodology</span>
              <span className="text-slate-100 text-xs">
                {data?.aqi?.methodology ?? 'Estimated Indian AQI — CPCB breakpoint methodology'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2">
              <span className="text-slate-300">AI Assistant</span>
              <span className="text-slate-100 text-xs">Google Gemini (server-side via GEMINI_MODEL)</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Air quality data comes from the Open-Meteo Air Quality API, with 24h (PM2.5, PM10, NO₂, SO₂) and 8h (CO, O₃) rolling averages mapped onto Indian CPCB breakpoints. All forecasts and model values are estimates, not official CPCB station measurements.
          </div>
        </section>

        {/* About */}
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-semibold text-white">About BreatheWise</h2>
          </div>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>BreatheWise is an AI-powered urban air quality decision-support companion built for PromptWars Virtual Challenge 6.</p>
            <p>All household preferences, daily plan check-offs, impact actions, and community challenge memberships are stored locally in your browser.</p>
            <p className="text-amber-300">
              BreatheWise does not replace professional medical advice. All recommendations are general informational guidance only.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
