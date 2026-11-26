import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/**
 * Formats an ISO timestamp into a human-readable relative time label.
 */
export function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  try {
    const diff = nowMs - new Date(iso).getTime();
    if (!Number.isFinite(diff) || diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

/**
 * Checks whether an ISO timestamp is older than `thresholdMinutes`.
 */
export function isTimestampStale(iso: string, thresholdMinutes = 120, nowMs = Date.now()): boolean {
  try {
    const diff = nowMs - new Date(iso).getTime();
    if (!Number.isFinite(diff)) return false;
    return diff > thresholdMinutes * 60_000;
  } catch {
    return false;
  }
}

export function windDirectionLabel(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(degrees / 45) % 8];
}

export function weatherCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Icy fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Light rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Light showers',
    81: 'Moderate showers',
    82: 'Heavy showers',
    95: 'Thunderstorm',
    99: 'Thunderstorm with hail',
  };
  return map[code] ?? 'Unknown';
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

