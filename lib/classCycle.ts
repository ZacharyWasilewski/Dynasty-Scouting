import type { Prospect } from "@/types/prospect";

/**
 * Class-cycle helpers deliberately derive their answers from the live prospect
 * snapshot instead of a hardcoded calendar year. The sheet is the authority:
 * adding the next devy class automatically advances every consumer of these
 * helpers without requiring a deployment-time year change.
 */
export function getTrackedClassYears(prospects: Prospect[], minYear = 2015): string[] {
  return [...new Set(
    prospects
      .map((p) => p.draftClass)
      .filter((year): year is string => Boolean(year) && Number.isFinite(Number(year)) && Number(year) >= minYear)
  )].sort((a, b) => Number(a) - Number(b));
}

/**
 * The primary in-progress scouting cycle.
 *
 * During a calendar year, the homepage should spotlight the NEXT draft class
 * whenever that class is already present in the sheet. For example, once the
 * 2026 season is underway, the public-facing cycle is 2027 — even if a few
 * 2026 prospects are still undrafted or awaiting final sheet updates. This is
 * still fully data-driven: when the next class is added, it becomes eligible
 * automatically; if it is not present yet, we fall back to the current-year
 * undrafted class rather than inventing a year.
 */
export function getActiveClassYear(prospects: Prospect[]): string | undefined {
  const currentYear = new Date().getFullYear();
  const undraftedYears = getTrackedClassYears(prospects)
    .filter((year) => prospects.some((p) => p.draftClass === year && p.hasDraftData !== true));

  const nextCycle = undraftedYears.find((year) => Number(year) > currentYear);
  if (nextCycle) return nextCycle;

  const currentCycle = undraftedYears.find((year) => Number(year) === currentYear);
  if (currentCycle) return currentCycle;

  // Defensive fallback for datasets whose calendar and draft flags are in an
  // unusual transition state. Never invent a year that is not in the sheet.
  return undraftedYears[0];
}

/** All live, undrafted class years, closest cycle first. */
export function getUpcomingClassYears(prospects: Prospect[]): string[] {
  const currentYear = new Date().getFullYear();
  const allUndrafted = getTrackedClassYears(prospects)
    .filter((year) => prospects.some((p) => p.draftClass === year && p.hasDraftData !== true));
  const currentOrFuture = allUndrafted.filter((year) => Number(year) >= currentYear);
  return currentOrFuture.length > 0 ? currentOrFuture : allUndrafted;
}
