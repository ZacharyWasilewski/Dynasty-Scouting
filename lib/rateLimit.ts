// Simple fixed-window, in-memory, per-IP rate limiter for API routes.
// State lives in this process's memory — it resets on restart and
// isn't shared across replicas, but for a single Railway instance
// that's exactly the audience this needs to protect: it stops a
// scripted loop from hammering an endpoint, without needing a new
// database or external service.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Without this, an attacker rotating through many IPs (or just normal
// traffic over days) would grow this map forever. A periodic sweep
// keeps memory bounded — the same class of bug we fixed in the sheet
// data cache, just for a different Map.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) buckets.delete(key);
  }
}

function getClientIp(request: Request): string {
  // Railway sits behind a proxy — the real client IP arrives via
  // x-forwarded-for, not the request's own (internal) socket address.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
}

export function checkRateLimit(
  request: Request,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  sweep(windowMs);
  const ip = getClientIp(request);
  const now = Date.now();
  const existing = buckets.get(ip);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.windowStart + windowMs,
  };
}
