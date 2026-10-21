import type { Prospect } from "@/types/prospect";
import { getTrackedClassYears, getActiveClassYear } from "@/lib/classCycle";
import { getAllStatus } from "@/lib/systemStatus";

export interface DbCounts {
  prospectCount: number;
  classCount: number;
  currentClassYear: string | undefined;
  currentClassProspectCount: number;
}

/**
 * The one place that answers "how many prospects/classes does the
 * database have right now." Every page/component displaying a
 * prospect or class count should call this rather than re-deriving
 * it locally.
 *
 * Before this existed, ClassesIndex computed its own total by only
 * summing prospects that had a `draftClass` set, while the Analytics
 * page's overallStats().total used a raw `prospects.length` — two
 * independent code paths answering the same question, one which
 * would silently drift from the other the moment a prospect existed
 * without a draftClass. This is pure and synchronous: it takes the
 * `Prospect[]` a page already fetched via getProspects() rather than
 * fetching anything itself, so it adds no extra I/O — and reuses the
 * same getTrackedClassYears/getActiveClassYear helpers classCycle.ts
 * already exports, so "which years count as tracked/active" logic
 * also lives in exactly one place.
 */
export function getDbCounts(prospects: Prospect[]): DbCounts {
  const currentClassYear = getActiveClassYear(prospects);
  return {
    prospectCount: prospects.length,
    classCount: getTrackedClassYears(prospects).length,
    currentClassYear,
    currentClassProspectCount: currentClassYear
      ? prospects.filter((p) => p.draftClass === currentClassYear).length
      : 0,
  };
}

/**
 * The real last-successful-fetch time for the sheet data currently
 * being served. Reuses the same lastSuccessAt already tracked by
 * lib/systemStatus.ts (reportStatus("google-sheet", "ok", ...), set
 * every time getSheetSnapshot() successfully refreshes) and already
 * surfaced on /admin/status and in the site footer — this is the
 * one existing authoritative timestamp, not a second, independently
 * derived value that could disagree with it. Sync (systemStatus's
 * state is in-memory, not a fetch), but returns a Date | null since
 * a cold process that hasn't completed its first fetch yet has no
 * value to report.
 */
export function getDataFreshness(): { lastUpdated: Date | null } {
  const lastSuccessAt = getAllStatus()["google-sheet"]?.lastSuccessAt ?? null;
  return { lastUpdated: lastSuccessAt ? new Date(lastSuccessAt) : null };
}
