// Lightweight, memory-bounded sliding-window rate limiter for API routes

interface RateLimitBucket {
  timestamps: number[];
  expiresAt: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  maxTrackedKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number, maxTrackedKeys: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= now) {
      buckets.delete(key);
    }
  }
  while (buckets.size > maxTrackedKeys) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

/**
 * Evaluates whether a request identified by `key` falls within the allowed rate limit window.
 * Automatically prunes expired timestamps and caps map growth to prevent memory leaks.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
  now = Date.now()
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 20;
  const maxTrackedKeys = options.maxTrackedKeys ?? 1000;
  const windowStart = now - windowMs;

  if (buckets.size > maxTrackedKeys || buckets.size % 50 === 49) {
    pruneExpiredBuckets(now, maxTrackedKeys);
  }

  const existing = buckets.get(key);
  const recent = existing ? existing.timestamps.filter((ts) => ts > windowStart) : [];

  if (recent.length >= maxRequests) {
    const earliest = recent[0] ?? now;
    const retryAfterMs = Math.max(1000, earliest + windowMs - now);
    buckets.set(key, { timestamps: recent, expiresAt: now + windowMs });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent, expiresAt: now + windowMs });

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - recent.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Clears all tracked rate-limit buckets (intended for unit testing).
 */
export function resetRateLimitStore(): void {
  buckets.clear();
}

/**
 * Extracts a normalized client identifier from forwarded request headers.
 */
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp.slice(0, 64);
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  return 'local-client';
}
