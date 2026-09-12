/**
 * A single in-memory place for every external data source (Sleeper,
 * ESPN, FantasyCalc, the sheet itself) and the data health check to
 * report their current state, so it can be read back on an admin
 * page instead of only ever existing as console.error lines in
 * Railway's log stream. Deliberately just a module-level object, not
 * a database table — this is operational status, not data worth
 * persisting across restarts; a fresh deploy starting with "unknown"
 * status for a few seconds until the first cycle reports in is fine.
 */

export type SourceStatus = "ok" | "stale" | "error" | "unknown";

export interface SourceReport {
  status: SourceStatus;
  message: string;
  lastSuccessAt: string | null;
  lastCheckedAt: string;
}

const store = new Map<string, SourceReport>();

export function reportStatus(source: string, status: SourceStatus, message: string): void {
  const prev = store.get(source);
  store.set(source, {
    status,
    message,
    lastSuccessAt: status === "ok" ? new Date().toISOString() : prev?.lastSuccessAt ?? null,
    lastCheckedAt: new Date().toISOString(),
  });
}

export function getAllStatus(): Record<string, SourceReport> {
  return Object.fromEntries(store.entries());
}

// Free-form log of the most recent data-health findings (duplicate
// ids, missing fields, DD Score swings) — capped so this can never
// grow unbounded across a long-running process.
const MAX_HEALTH_EVENTS = 30;
interface HealthEvent {
  at: string;
  message: string;
}
const healthEvents: HealthEvent[] = [];

export function reportHealthEvent(message: string): void {
  healthEvents.unshift({ at: new Date().toISOString(), message });
  if (healthEvents.length > MAX_HEALTH_EVENTS) healthEvents.length = MAX_HEALTH_EVENTS;
}

export function getHealthEvents(): HealthEvent[] {
  return healthEvents;
}

/** process.memoryUsage() is Node-only, but this file only ever runs
 *  server-side (a page.tsx server component, or a route handler),
 *  so that's always the environment it executes in. */
export function getMemorySnapshot(): { rssMb: number; heapUsedMb: number; heapTotalMb: number } {
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  return {
    rssMb: toMb(mem.rss),
    heapUsedMb: toMb(mem.heapUsed),
    heapTotalMb: toMb(mem.heapTotal),
  };
}
