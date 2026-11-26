'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';
import type { UserPreferences } from '@/types';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '@/lib/preferences';

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedPrefs: UserPreferences = DEFAULT_PREFERENCES;

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'breathewise_preferences') callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem('breathewise_preferences');
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedPrefs = raw ? loadPreferences() : DEFAULT_PREFERENCES;
    }
    return cachedPrefs;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getServerSnapshot(): UserPreferences {
  return DEFAULT_PREFERENCES;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const next = { ...getSnapshot(), ...updates };
    savePreferences(next);
    cachedRaw = JSON.stringify(next);
    cachedPrefs = next;
    listeners.forEach((l) => l());
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
