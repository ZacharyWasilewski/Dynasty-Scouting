import type { Prospect, DraftClassYear, Position } from "@/types/prospect";

export interface TierHitRateDatum {
  tier: string;
  hitRate: number | null; // null = no graded-and-resolved prospects in this tier
  count: number; // resolved (HIT/MISS) prospects only
  total: number; // every prospect in this tier, resolved or not
}

/**
 * Real hit rate per tier, computed directly from prospects (their
 * tier + actual career outcome), optionally filtered to one
 * position. Only counts prospects with a resolved HIT/MISS outcome —
 * hitRate is null (not 0) for a tier with no resolved prospects yet,
 * so the UI can show "N/A" instead of a misleading 0%.
 */
export function computeHitRateByTier(
  prospects: Prospect[],
  tiers: string[],
  position?: Position
): TierHitRateDatum[] {
  return tiers.map((tier) => {
    const inTier = prospects.filter(
      (p) => p.tier === tier && (!position || p.position === position)
    );
    const resolved = inTier.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
    const hits = resolved.filter((p) => p.hitMiss === "HIT").length;
    return {
      tier,
      hitRate: resolved.length > 0 ? (hits / resolved.length) * 100 : null,
      count: resolved.length,
      total: inTier.length,
    };
  });
}

export interface BarDatum {
  label: string;
  value: number;
  count?: number;
}

/** Unique draft classes present in the data, sorted most recent first. */
function draftClassesInData(prospects: Prospect[]): string[] {
  const years = new Set<string>();
  prospects.forEach((p) => {
    if (p.draftClass && Number(p.draftClass) >= 2015) years.add(p.draftClass);
  });
  return [...years].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

/** Buckets graded prospects into 10-point score ranges. */
export function computeScoreDistribution(prospects: Prospect[]): BarDatum[] {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 9}`,
    value: 0,
  }));

  prospects.forEach((p) => {
    const score = p.grade?.overall;
    if (score === undefined) return;
    const idx = Math.min(9, Math.max(0, Math.floor(score / 10)));
    const bucket = buckets[idx];
    if (bucket) bucket.value += 1;
  });

  return buckets;
}

/** Average Prospect Score for a fixed set of marquee positions. */
export function computeAverageByPosition(
  prospects: Prospect[],
  positions: Position[]
): BarDatum[] {
  return positions.map((position) => {
    const scored = prospects.filter(
      (p) => p.position === position && p.grade?.overall !== undefined
    );
    const avg =
      scored.length > 0
        ? scored.reduce((sum, p) => sum + (p.grade!.overall as number), 0) / scored.length
        : 0;
    return { label: position, value: Number(avg.toFixed(1)), count: scored.length };
  });
}

/** Average Prospect Score per draft class actually present in the data. */
export function computeAverageByDraftClass(prospects: Prospect[]): BarDatum[] {
  return draftClassesInData(prospects).map((year) => {
    const scored = prospects.filter(
      (p) => p.draftClass === year && p.grade?.overall !== undefined
    );
    const avg =
      scored.length > 0
        ? scored.reduce((sum, p) => sum + (p.grade!.overall as number), 0) / scored.length
        : 0;
    return { label: year, value: Number(avg.toFixed(1)), count: scored.length };
  });
}

export interface TrendPoint {
  label: DraftClassYear;
  value: number;
}

/** Number of graded prospects tracked per draft class, across time. */
export function computeClassTrend(prospects: Prospect[]): TrendPoint[] {
  return draftClassesInData(prospects)
    .slice()
    .reverse() // oldest first for a left-to-right timeline
    .map((year) => ({
      label: year,
      value: prospects.filter((p) => p.draftClass === year).length,
    }));
}

export function overallStats(prospects: Prospect[]) {
  const scored = prospects.filter((p) => p.grade?.overall !== undefined);
  const avg =
    scored.length > 0
      ? scored.reduce((sum, p) => sum + (p.grade!.overall as number), 0) / scored.length
      : undefined;
  return {
    total: prospects.length,
    scored: scored.length,
    average: avg,
    classesTracked: draftClassesInData(prospects).length,
  };
}
