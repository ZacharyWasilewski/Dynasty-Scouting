import type { Prospect, Position, Tier, SubScore } from "@/types/prospect";
import { getTierForScore } from "@/lib/tiers";
import { getDisplayedPreDraftScore } from "@/lib/prospects";

/**
 * The four league-format variants the model computes. Every DD-Score-
 * driven chart on the Analytics page can be viewed through any of
 * these — QB format and TE premium are independent axes, matching the
 * Mock Draft page's own format switches.
 */
export type QbFormat = "1QB" | "SF";
export type TepFormat = "STANDARD" | "TEP";

export interface LeagueFormatSelection {
  qbFormat: QbFormat;
  tepFormat: TepFormat;
}

export const DEFAULT_FORMAT: LeagueFormatSelection = { qbFormat: "1QB", tepFormat: "STANDARD" };

/** The prospect's DD Score for the selected league format, or undefined if not yet resolved/drafted. */
export function ddScoreForFormat(p: Prospect, sel: LeagueFormatSelection): number | undefined {
  if (sel.qbFormat === "1QB") {
    return sel.tepFormat === "TEP" ? p.ddScore1QBTEP : p.ddScore1QB;
  }
  return sel.tepFormat === "TEP" ? p.ddScoreSuperflexTEP : p.ddScoreSuperflex;
}

/** The prospect's DD tier for the selected league format. */
export function tierForFormat(p: Prospect, sel: LeagueFormatSelection): Tier | undefined {
  if (sel.qbFormat === "1QB") {
    return sel.tepFormat === "TEP" ? p.tier1QBTEP : p.tier1QB;
  }
  return sel.tepFormat === "TEP" ? p.tierSuperflexTEP : p.tierSuperflex;
}

/** The Analytics page's format selection, mapped to the /players-style
 *  LeagueFormat query value ("1QB" | "1QB_TEP" | "SUPERFLEX" |
 *  "SUPERFLEX_TEP"), so a tier deep-link can carry the format across. */
export function formatQueryValue(sel: LeagueFormatSelection): string {
  if (sel.qbFormat === "1QB") {
    return sel.tepFormat === "TEP" ? "1QB_TEP" : "1QB";
  }
  return sel.tepFormat === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX";
}

/** Reverse of formatQueryValue — converts the rankings table's own
 *  LeagueFormat value into the Analytics-style selection, so pages can
 *  drive a DD-Score chart off the exact same QB/TEP switches already
 *  shown on a rankings table instead of a separate toggle set. */
export function selectionFromLeagueFormat(format: string): LeagueFormatSelection {
  return {
    qbFormat: format === "SUPERFLEX" || format === "SUPERFLEX_TEP" ? "SF" : "1QB",
    tepFormat: format === "1QB_TEP" || format === "SUPERFLEX_TEP" ? "TEP" : "STANDARD",
  };
}

/**
 * Quality-of-outcome weights for the "Weighted" scoring mode, keyed by
 * the sheet's real fantasy-finish grade (within 3 years). Distinct from
 * plain HIT/MISS: RP is deliberately the midpoint (a "push" — no value
 * gained or lost), Bust is the true floor at 0, and SuperStar is left
 * uncapped above 100 since a repeat top-12 finisher is a fundamentally
 * rarer, more valuable outcome than "the best of the ordinary tiers" —
 * a bucket stacked with SuperStars should genuinely average higher than
 * one stacked with Studs. The displayed Value Score is still capped at
 * 100% after averaging (see meanWeight) so it stays comparable to the
 * 0–100% Standard hit rate; only the raw per-player weight goes higher.
 * This is an editorial scale, not a derived constant; adjust here if
 * the weighting philosophy changes; every consumer reads from this
 * single source.
 */
export const FINISH_WEIGHTS: Record<string, number> = {
  superstar: 130,
  stud: 100,
  mys: 80,
  "1ys": 65,
  rp: 50,
  bench: 25,
  bust: 0,
};

function normalizeFinishKey(finish: string | undefined): string | undefined {
  if (!finish) return undefined;
  return finish.trim().toLowerCase().replace(/\s+/g, "");
}

/** The Weighted-mode quality score for a prospect's real finish grade, or undefined if unresolved/unrecognized. */
export function finishWeight(finish: string | undefined): number | undefined {
  const key = normalizeFinishKey(finish);
  return key === undefined ? undefined : FINISH_WEIGHTS[key];
}

function meanWeight(prospects: Prospect[]): { avg: number | null; count: number } {
  const weights = prospects
    .map((p) => finishWeight(p.finish))
    .filter((w): w is number => w !== undefined);
  if (weights.length === 0) return { avg: null, count: 0 };
  const rawAvg = weights.reduce((a, b) => a + b, 0) / weights.length;
  // Individual players can score above 100 (SuperStar = 130), but the
  // displayed Value Score is capped at 100 — a bucket of all SuperStars
  // averages higher than one of mixed Studs internally, it just can't
  // display past the same ceiling the Standard hit rate uses.
  return { avg: Math.min(rawAvg, 100), count: weights.length };
}

export interface TierHitRateDatum {
  tier: string;
  hitRate: number | null; // null = no graded-and-resolved prospects in this tier
  count: number; // resolved (HIT/MISS) prospects only
  total: number; // every prospect in this tier, resolved or not
  valueScore: number | null; // Weighted-mode average finish-quality score, null if none resolved
  valueCount: number; // prospects with a recognized finish grade
}

/**
 * Real hit rate per tier, computed directly from prospects (their
 * tier + actual career outcome), optionally filtered to one
 * position. Only counts prospects with a resolved HIT/MISS outcome —
 * hitRate is null (not 0) for a tier with no resolved prospects yet,
 * so the UI can show "N/A" instead of a misleading 0%.
 *
 * Also returns valueScore — the same tier bucket, aggregated instead
 * by finishWeight() — so Standard and Weighted scoring modes always
 * describe the identical group of players, just averaged two
 * different ways.
 */
/**
 * A single combined hit rate across a set of tiers (e.g. Generational
 * + Elite) — for a homepage "here's the model's real track record"
 * stat, where a per-tier breakdown is more detail than the moment
 * calls for. Computed directly from real hit/miss outcomes, the same
 * ones the full Analytics page's tier chart uses — never a made-up
 * or aspirational number.
 */
export function computeCombinedHitRate(
  prospects: Prospect[],
  tiers: string[],
  format: LeagueFormatSelection = DEFAULT_FORMAT
): { hitRate: number; sampleSize: number } | null {
  const inTiers = prospects.filter((p) => tiers.includes(tierForFormat(p, format) ?? ""));
  const resolved = inTiers.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
  if (resolved.length === 0) return null;
  const hits = resolved.filter((p) => p.hitMiss === "HIT").length;
  return { hitRate: (hits / resolved.length) * 100, sampleSize: resolved.length };
}

export function computeHitRateByTier(
  prospects: Prospect[],
  tiers: string[],
  position?: Position,
  format: LeagueFormatSelection = DEFAULT_FORMAT
): TierHitRateDatum[] {
  return tiers.map((tier) => {
    const inTier = prospects.filter(
      (p) => tierForFormat(p, format) === tier && (!position || p.position === position)
    );
    const resolved = inTier.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
    const hits = resolved.filter((p) => p.hitMiss === "HIT").length;
    const { avg, count: valueCount } = meanWeight(inTier);
    return {
      tier,
      hitRate: resolved.length > 0 ? (hits / resolved.length) * 100 : null,
      count: resolved.length,
      total: inTier.length,
      valueScore: avg,
      valueCount,
    };
  });
}

/**
 * A prospect's tier, using the exact same logic the rest of the site
 * actually uses to display it — tierForFormat's precomputed,
 * format-specific fields for drafted players (tier1QB, tierSuperflex,
 * etc, built on TIER_DEFINITIONS' regular thresholds), or a
 * Pre-Draft-Score-based tier for devy prospects (format-independent,
 * since Pre-Draft Score itself doesn't vary by league format).
 *
 * This matters because getPositionalTierForScore (used by the old
 * version of this function, below) is a DIFFERENT tier system with
 * different thresholds — same tier names, different underlying
 * score ranges. Computing a hit rate against one tier system while
 * labeling/displaying it under the other is a real, confirmed bug
 * that shipped: the stated fraction and the stated percentage could
 * mathematically contradict each other, because they weren't
 * actually describing the same group of prospects.
 */
function displayedTierForProspect(p: Prospect, format: LeagueFormatSelection): Tier | undefined {
  if (p.hasDraftData === true) return tierForFormat(p, format);
  const score = getDisplayedPreDraftScore(p);
  return score !== undefined ? getTierForScore(score) : undefined;
}

/**
 * The historical hit rate for a specific position, broken down by
 * tier — using whichever tier the site actually displays for that
 * format (see displayedTierForProspect above), not a separately
 * computed "positional tier" that could disagree with what's shown
 * on screen. This is what the player profile's "Hit Rate at This
 * Tier" section is built from — always the exact same tier a visitor
 * is looking at, for whichever league format they've selected.
 */
export function computeHitRateByPositionAndTier(
  prospects: Prospect[],
  position: Position,
  format: LeagueFormatSelection,
  tiers: string[]
): TierHitRateDatum[] {
  return tiers.map((tier) => {
    const inTier = prospects.filter((p) => p.position === position && displayedTierForProspect(p, format) === tier);
    const resolved = inTier.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
    const hits = resolved.filter((p) => p.hitMiss === "HIT").length;
    const { avg, count: valueCount } = meanWeight(inTier);
    return {
      tier,
      hitRate: resolved.length > 0 ? (hits / resolved.length) * 100 : null,
      count: resolved.length,
      total: inTier.length,
      valueScore: avg,
      valueCount,
    };
  });
}

export interface CapitalTierDefinition {
  label: string;
  min: number;
  max: number; // inclusive
}

/**
 * Real NFL draft-capital tiers, by overall pick number. Fixed
 * boundaries (not round-count-derived) since draft classes vary in
 * size (comp picks, etc.) — 1st/2nd/3rd round get their own tier,
 * 4th-5th and 6th-7th (plus UDFA-adjacent late picks) are grouped.
 */
export const CAPITAL_TIERS: CapitalTierDefinition[] = [
  { label: "Round 1", min: 1, max: 32 },
  { label: "Round 2", min: 33, max: 64 },
  { label: "Round 3", min: 65, max: 100 },
  { label: "Rounds 4–5", min: 101, max: 180 },
  { label: "Rounds 6–7+", min: 181, max: Infinity },
];

export interface CapitalVsModelDatum {
  tier: string;
  capitalHitRate: number | null;
  capitalCount: number;
  modelHitRate: number | null;
  modelCount: number;
  capitalValueScore: number | null;
  modelValueScore: number | null;
}

/**
 * Compares two ways of sorting the exact same cohort of resolved
 * (real HIT/MISS outcome) prospects into 5 capital-sized tiers:
 *
 *  - "Draft capital" side: bucketed by real ADP (actual NFL draft
 *    position) into the fixed CAPITAL_TIERS ranges.
 *  - "Model" side: the SAME cohort, ranked by DD Score instead, then
 *    sliced into groups matching each capital tier's real population
 *    size — so "the model's Round 1" is its top-N picks, where N is
 *    however many players were actually drafted in Round 1. Same
 *    player count per tier both ways, so any hit-rate gap reflects
 *    which ranking (the NFL's or the model's) actually separated
 *    future producers from busts, not a difference in sample size.
 */
export function computeCapitalVsModelHitRates(
  prospects: Prospect[],
  format: LeagueFormatSelection = DEFAULT_FORMAT
): CapitalVsModelDatum[] {
  const cohort = prospects.filter(
    (p) => p.adp !== undefined && (p.hitMiss === "HIT" || p.hitMiss === "MISS")
  );

  const capitalBuckets = CAPITAL_TIERS.map((t) =>
    cohort.filter((p) => (p.adp as number) >= t.min && (p.adp as number) <= t.max)
  );

  const rankedByModel = cohort
    .filter((p) => ddScoreForFormat(p, format) !== undefined)
    .slice()
    .sort((a, b) => (ddScoreForFormat(b, format) as number) - (ddScoreForFormat(a, format) as number));

  const modelBuckets: Prospect[][] = [];
  let cursor = 0;
  for (const bucket of capitalBuckets) {
    modelBuckets.push(rankedByModel.slice(cursor, cursor + bucket.length));
    cursor += bucket.length;
  }

  return CAPITAL_TIERS.map((t, i) => {
    const capBucket = capitalBuckets[i] ?? [];
    const modBucket = modelBuckets[i] ?? [];
    const capHits = capBucket.filter((p) => p.hitMiss === "HIT").length;
    const modHits = modBucket.filter((p) => p.hitMiss === "HIT").length;
    const capValue = meanWeight(capBucket);
    const modValue = meanWeight(modBucket);
    return {
      tier: t.label,
      capitalHitRate: capBucket.length > 0 ? (capHits / capBucket.length) * 100 : null,
      capitalCount: capBucket.length,
      modelHitRate: modBucket.length > 0 ? (modHits / modBucket.length) * 100 : null,
      modelCount: modBucket.length,
      capitalValueScore: capValue.avg,
      modelValueScore: modValue.avg,
    };
  });
}

export interface RoundBucketGroup {
  label: string; // class year
  rounds: (number | null)[];
}

/**
 * Within one draft class, the prospects ranked by the selected format's
 * DD Score and chunked into fixed-size "rounds" — round 1 is simply the
 * top `roundSize` players by DD Score, not who was actually drafted
 * first. Only resolved prospects (real DD Score requires real ADP+OPP)
 * can appear here, so an in-progress class with no real draft history
 * yet naturally produces empty rounds rather than a misleading number.
 */
function ddScoreRoundBuckets(
  prospects: Prospect[],
  classYear: string,
  format: LeagueFormatSelection,
  roundSize: number,
  numRounds: number
): Prospect[][] {
  const ranked = prospects
    .filter((p) => p.draftClass === classYear && ddScoreForFormat(p, format) !== undefined)
    .slice()
    .sort((a, b) => (ddScoreForFormat(b, format) as number) - (ddScoreForFormat(a, format) as number));

  return Array.from({ length: numRounds }, (_, i) => ranked.slice(i * roundSize, (i + 1) * roundSize));
}

/**
 * Hit rate by DD-Score round, per class — the model's own top-N-by-
 * DD-Score groups (N = roundSize, default a 12-team startup round)
 * stand in for "round" instead of the sheet's real NFL round data.
 * Also returns the Weighted-mode equivalent (average finish quality)
 * from the identical buckets, same pattern as computeHitRateByTier.
 */
export function computeDDScoreRoundHitRates(
  prospects: Prospect[],
  classYears: string[],
  format: LeagueFormatSelection = DEFAULT_FORMAT,
  roundSize = 12,
  numRounds = 4
): { hitRate: RoundBucketGroup[]; valueScore: RoundBucketGroup[] } {
  const hitRate: RoundBucketGroup[] = [];
  const valueScore: RoundBucketGroup[] = [];

  for (const classYear of classYears) {
    const buckets = ddScoreRoundBuckets(prospects, classYear, format, roundSize, numRounds);
    hitRate.push({
      label: classYear,
      rounds: buckets.map((bucket) => {
        const resolved = bucket.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
        if (resolved.length === 0) return null;
        const hits = resolved.filter((p) => p.hitMiss === "HIT").length;
        return (hits / resolved.length) * 100;
      }),
    });
    valueScore.push({
      label: classYear,
      rounds: buckets.map((bucket) => meanWeight(bucket).avg),
    });
  }

  return { hitRate, valueScore };
}

/**
 * Average DD Score by DD-Score round, per class — literally the mean
 * DD Score of the players the model itself grouped into each round.
 * This replaces the sheet's real-NFL "Average Value by round" stat,
 * since there's no per-player Approximate Value in the data pipeline
 * to rebucket; it measures how steeply the model's own grades taper
 * off within a class, not real career production.
 */
export function computeDDScoreRoundAverages(
  prospects: Prospect[],
  classYears: string[],
  format: LeagueFormatSelection = DEFAULT_FORMAT,
  roundSize = 12,
  numRounds = 4
): RoundBucketGroup[] {
  return classYears.map((classYear) => {
    const buckets = ddScoreRoundBuckets(prospects, classYear, format, roundSize, numRounds);
    return {
      label: classYear,
      rounds: buckets.map((bucket) => {
        if (bucket.length === 0) return null;
        const scores = bucket.map((p) => ddScoreForFormat(p, format) as number);
        return scores.reduce((a, b) => a + b, 0) / scores.length;
      }),
    };
  });
}

export interface BarDatum {
  label: string;
  value: number;
  count?: number;
}

/** Unique draft classes present in the data, sorted most recent first. */
export function draftClassesInData(prospects: Prospect[]): string[] {
  const years = new Set<string>();
  prospects.forEach((p) => {
    if (p.draftClass && Number(p.draftClass) >= 2015) years.add(p.draftClass);
  });
  return [...years].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

/** Buckets graded prospects into 10-point score ranges. */
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

export interface SubScoreSignal {
  label: string;
  index: number; // the sub-score's slot (0-3), consistent within a position
  bottomHitRate: number | null; // 0-100, hit rate for the bottom third on this metric
  topHitRate: number | null; // 0-100, hit rate for the top third on this metric
  lift: number | null; // topHitRate - bottomHitRate, in points — how much this one input predicts hitting
  bottomCount: number;
  topCount: number;
}
export interface PositionSubScoreSignal {
  position: Position;
  signals: SubScoreSignal[]; // one per sub-score slot, in the position's real display order
}

const SIGNAL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
// Below this many resolved (real Hit/Miss) prospects with a numeric
// value on a given metric, a top/bottom-third split is too small a
// sample to mean anything — shown as N/A rather than a misleading lift.
const MIN_SIGNAL_SAMPLE = 12;

/**
 * For each of a position's 4 named sub-scores (e.g. QB: Production,
 * Rushing, Draft Capital, Opportunity), splits resolved prospects into
 * top and bottom thirds by that one metric and compares their real
 * hit rates. The gap between them ("lift") is a rough read on how much
 * signal that single input actually carries on its own — independent
 * of DD Score's calibrated blend, which combines all of a position's
 * inputs together.
 */
export function computeSubScoreSignals(prospects: Prospect[]): PositionSubScoreSignal[] {
  return SIGNAL_POSITIONS.map((position) => {
    const pool = prospects.filter(
      (p) =>
        p.position === position &&
        (p.hitMiss === "HIT" || p.hitMiss === "MISS") &&
        p.subScores &&
        p.subScores.length > 0
    );
    const slotCount = pool.reduce((max, p) => Math.max(max, p.subScores?.length ?? 0), 0);

    const signals: SubScoreSignal[] = [];
    for (let i = 0; i < slotCount; i++) {
      const withValue = pool
        .map((p) => ({ p, sub: p.subScores?.[i] }))
        .filter((x): x is { p: Prospect; sub: SubScore } => x.sub?.value !== undefined);

      const label = withValue[0]?.sub.label ?? `Metric ${i + 1}`;

      if (withValue.length < MIN_SIGNAL_SAMPLE) {
        signals.push({ label, index: i, bottomHitRate: null, topHitRate: null, lift: null, bottomCount: 0, topCount: 0 });
        continue;
      }

      const sorted = [...withValue].sort((a, b) => (a.sub.value ?? 0) - (b.sub.value ?? 0));
      const third = Math.max(1, Math.floor(sorted.length / 3));
      const bottom = sorted.slice(0, third);
      const top = sorted.slice(sorted.length - third);
      const hitRate = (group: typeof bottom) => (group.filter((x) => x.p.hitMiss === "HIT").length / group.length) * 100;
      const bottomHitRate = hitRate(bottom);
      const topHitRate = hitRate(top);

      signals.push({
        label,
        index: i,
        bottomHitRate,
        topHitRate,
        lift: topHitRate - bottomHitRate,
        bottomCount: bottom.length,
        topCount: top.length,
      });
    }

    return { position, signals };
  });
}

export interface OpportunityOptionHitRate {
  label: string; // the sheet's actual depth-chart label, e.g. "QB1", "Committee"
  hitRate: number; // 0-100
  count: number;
  /** Sample too small to read much into — still shown (real data,
   *  never hidden), just visually de-emphasized by the chart. */
  lowSample: boolean;
}
export interface PositionOpportunityHitRates {
  position: Position;
  /** Ranked labels (QB1, QB2, ...) sorted in real depth-chart order;
   *  any unranked labels follow, sorted by hit rate. */
  options: OpportunityOptionHitRate[];
}

// Below this many resolved prospects sharing an Opportunity label, one
// or two outcomes can swing the rate to 0% or 100% — real, but not
// meaningful on its own, so the chart flags it rather than hides it.
const MIN_OPPORTUNITY_OPTION_SAMPLE = 4;

// QB and WR use real-world role labels rather than a clean numeric
// depth-chart rank (e.g. "MEN", "QB2P" vs. "QB2H" — two different
// backup situations, not a strict 2nd/3rd order), so they get an
// explicit left-to-right order instead of the generic rank-number
// sort below. RB and TE's labels already sort correctly that way.
const OPPORTUNITY_LABEL_ORDER: Partial<Record<Position, string[]>> = {
  QB: ["QB1", "MEN", "QB2P", "QB2H", "DEPTH"],
  WR: ["WR1", "COM", "WR2U", "WR2", "DEPTH"],
};

/**
 * Opportunity is the one sub-score stored as a real-world label
 * (e.g. "QB1", "Committee") rather than a percentile — it's meant to
 * be read by eye on a profile, not averaged. This instead measures it
 * directly on its own terms: the actual historical hit rate for every
 * prospect who carried each specific label, per position.
 */
export function computeOpportunityHitRates(prospects: Prospect[]): PositionOpportunityHitRates[] {
  return SIGNAL_POSITIONS.map((position) => {
    const pool = prospects.filter(
      (p) => p.position === position && (p.hitMiss === "HIT" || p.hitMiss === "MISS")
    );

    const groups = new Map<string, Prospect[]>();
    for (const p of pool) {
      const opportunity = p.subScores?.find((s) => s.label === "Opportunity");
      const label = opportunity?.text;
      if (!label || opportunity?.isPending) continue;
      const list = groups.get(label);
      if (list) list.push(p);
      else groups.set(label, [p]);
    }

    const explicitOrder = OPPORTUNITY_LABEL_ORDER[position];

    const options: OpportunityOptionHitRate[] = [...groups.entries()]
      .map(([label, list]) => {
        const hits = list.filter((p) => p.hitMiss === "HIT").length;
        return {
          label,
          hitRate: (hits / list.length) * 100,
          count: list.length,
          lowSample: list.length < MIN_OPPORTUNITY_OPTION_SAMPLE,
        };
      })
      .sort((a, b) => {
        if (explicitOrder) {
          const idxA = explicitOrder.findIndex((o) => o.toLowerCase() === a.label.toLowerCase());
          const idxB = explicitOrder.findIndex((o) => o.toLowerCase() === b.label.toLowerCase());
          // A label the sheet produces that isn't in the fixed list
          // yet (e.g. a new role type) falls to the end by hit rate,
          // rather than silently vanishing from the chart.
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return b.hitRate - a.hitRate;
        }
        // RB/TE: labels ending in a rank number (RB1, RB2, TE1, ...)
        // read left to right in real depth-chart order instead of
        // being shuffled by whichever happened to hit most. Anything
        // without a trailing number sorts after, by hit rate.
        const rankOf = (label: string) => {
          const match = label.match(/(\d+)\s*$/);
          return match ? Number(match[1]) : null;
        };
        const rankA = rankOf(a.label);
        const rankB = rankOf(b.label);
        if (rankA !== null && rankB !== null) return rankA - rankB;
        if (rankA !== null) return -1;
        if (rankB !== null) return 1;
        return b.hitRate - a.hitRate;
      });

    return { position, options };
  });
}
