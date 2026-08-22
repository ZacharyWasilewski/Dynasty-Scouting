import type { Prospect, Tier } from "@/types/prospect";
import { getTierForScore } from "@/lib/tiers";

export type MockLeagueSize = 8 | 10 | 12 | 14 | 16;
export type MockQBFormat = "1QB" | "SUPERFLEX";
export type MockTEFormat = "STANDARD" | "TEP";
export type MockEngine = "DD" | "COMMUNITY";
/** Seconds allowed per user pick, or "UNTIMED" for no clock. */
export type MockPickTimer = "UNTIMED" | 15 | 30 | 45 | 60 | 120 | 300;

export type CommunityFormatKey = "FC_1QB_STANDARD" | "FC_1QB_TE_PLUS" | "FC_SF_STANDARD" | "FC_SF_TE_PLUS";


export function getCommunityFormatKey(qb: MockQBFormat, te: MockTEFormat): CommunityFormatKey {
  // NFL Mock Draft Database exposes separate 1QB and Superflex rookie boards.
  // TE+ is not a separate source board, so the Community layer applies the
  // same percentile-based TE adjustment used elsewhere in this project.
  if (qb === "SUPERFLEX") {
    return te === "TEP" ? "FC_SF_TE_PLUS" : "FC_SF_STANDARD";
  }
  return te === "TEP" ? "FC_1QB_TE_PLUS" : "FC_1QB_STANDARD";
}

export function getCommunityFormatLabel(qb: MockQBFormat, te: MockTEFormat): string {
  const qbLabel = qb === "SUPERFLEX" ? "Superflex" : "1 QB";
  const teLabel = te === "TEP" ? "TE+" : "Off";
  return `${qbLabel} · ${teLabel}`;
}
export interface MockSettings {
  teams: MockLeagueSize;
  qbFormat: MockQBFormat;
  teFormat: MockTEFormat;
  slot: number;
  engine: MockEngine;
  pickTimer: MockPickTimer;
}

export interface CommunityPlayer {
  rank: number;
  value?: number;
  tier?: number;
  eligibleYear?: string;
  sourceRank?: number;
}

export interface MockPick {
  overall: number;
  round: number;
  slot: number;
  playerId: string;
  userPick: boolean;
}

export const TIER_ORDER: Record<string, number> = {
  Generational: 0,
  Elite: 1,
  Starter: 2,
  Flex: 3,
  "Upside Shot": 4,
  Bench: 5,
  "Taxi Squad": 6,
  "Roster Clogger": 7,
};

export function getActiveMockClass(now = new Date()): string {
  // Use a North-American Eastern calendar date so the annual rollover
  // happens on September 1 for the site rather than at an arbitrary UTC
  // boundary on the evening of August 31.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return month >= 9 ? String(year + 1) : String(year);
}

/**
 * Any class after the primary drafting class that already has Pre-Draft
 * Score data — currently just the 2027 devy class, but this stays correct
 * automatically as classes roll forward without hardcoding a year.
 * Shared by the Mock Draft page and My Big Board, so both ever offer the
 * exact same set of classes rather than two lists that can drift apart.
 */
export function getFutureMockClasses(
  prospects: { draftClass?: string; preDraftScore?: number }[],
  primaryClassYear: string
): string[] {
  const hasPreDraft = (year: string) =>
    prospects.some((p) => p.draftClass === year && p.preDraftScore !== undefined);
  return [...new Set(prospects.map((p) => p.draftClass))]
    .filter((y): y is string => !!y && Number(y) > Number(primaryClassYear) && hasPreDraft(y))
    .sort((a, b) => Number(a) - Number(b));
}

/** The full set of classes offered on both the Mock Draft page and My
 *  Big Board — the current draftable class plus any future/devy
 *  classes already carrying Pre-Draft Score data. */
export function getMockableClassYears(prospects: { draftClass?: string; preDraftScore?: number }[]): string[] {
  const primary = getActiveMockClass();
  return [primary, ...getFutureMockClasses(prospects, primary)];
}

export function getRankForFormat(p: Prospect, qb: MockQBFormat, te: MockTEFormat): number | undefined {
  if (qb === "SUPERFLEX" && te === "TEP") return p.ddRankSuperflexTEP;
  if (qb === "SUPERFLEX") return p.ddRankSuperflex;
  if (te === "TEP") return p.ddRank1QBTEP;
  return p.ddRank1QB;
}

/**
 * Undrafted / future classes (e.g. the 2027 devy class) have no DD Score
 * yet — there's no real NFL draft capital to calibrate against. In that
 * case the engine falls back to the sheet's Pre-Draft Score, which is a
 * single cross-format number, so the mock draft's selection logic works
 * identically either way.
 */
export function getScoreForFormat(p: Prospect, qb: MockQBFormat, te: MockTEFormat): number | undefined {
  if (qb === "SUPERFLEX" && te === "TEP") return p.ddScoreSuperflexTEP ?? p.ddScoreSuperflex ?? p.preDraftScore;
  if (qb === "SUPERFLEX") return p.ddScoreSuperflex ?? p.preDraftScore;
  if (te === "TEP") return p.ddScore1QBTEP ?? p.ddScore1QB ?? p.preDraftScore;
  return p.ddScore1QB ?? p.preDraftScore;
}

export function getTierForFormat(p: Prospect, qb: MockQBFormat, te: MockTEFormat): Tier | undefined {
  const tier =
    qb === "SUPERFLEX" && te === "TEP" ? p.tierSuperflexTEP ?? p.tierSuperflex :
    qb === "SUPERFLEX" ? p.tierSuperflex :
    te === "TEP" ? p.tier1QBTEP ?? p.tier1QB :
    p.tier1QB;
  // Same Pre-Draft Score fallback as getScoreForFormat, using the site's
  // standard DD tier bands so an undrafted prospect's tier reads on the
  // same scale as everyone else's.
  return tier ?? getTierForScore(p.preDraftScore);
}

/**
 * The computer treats tiers as probability bands, not hard boundaries.
 * Score clustering is deliberately stronger than rank distance: four
 * players separated by fractions of a point remain close in probability,
 * while a large score gap is punished sharply. Crossing a tier boundary
 * adds another penalty, but never makes the lower tier impossible.
 */
export function normalizePlayerName(name: string): string {
  return name
    .replace(/[®™]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Draft selection probability is deliberately shaped around the same idea as
 * Dynasty Database tiers: players within a tight score cluster should be
 * relatively interchangeable, while crossing a tier boundary is a much
 * sharper drop. The engine also has guardrails against absurd outliers being
 * selected at the very top of a rookie draft.
 */
export function getSelectionWeight(
  p: Prospect,
  available: Prospect[],
  settings: MockSettings,
  community?: Map<string, CommunityPlayer>,
  overallPick = 1,
  ddRankMap?: Map<string, number>
): number {
  const round = Math.floor((overallPick - 1) / settings.teams) + 1;

  if (settings.engine === "COMMUNITY") {
    const cp = community?.get(normalizePlayerName(p.name));
    if (!cp || !Number.isFinite(cp.rank)) return 0;

    const availableCommunity = available
      .map((x) => ({ p: x, c: community?.get(normalizePlayerName(x.name)) }))
      .filter((x): x is { p: Prospect; c: CommunityPlayer } => !!x.c && Number.isFinite(x.c.rank));
    if (!availableCommunity.length) return 0;

    const bestRank = Math.min(...availableCommunity.map((x) => x.c.rank));
    const bestRanked = availableCommunity.find((x) => x.c.rank === bestRank);
    const bestTier = Math.min(...availableCommunity.map((x) => x.c.tier ?? 99));
    const communityTier = cp.tier ?? 99;
    const rankGap = Math.max(0, cp.rank - bestRank);
    const tierGap = Math.max(0, communityTier - bestTier);

    // FantasyCalc values are on a 0-10,000 scale. Community players may move
    // ahead of the highest-ranked available player, but only when their actual
    // value is reasonably close. A player who is dramatically lower in value
    // should never leapfrog an elite player simply because the weighted engine
    // happened to give them a non-zero probability.
    const VALUE_OUT_OF_ORDER_MAX_GAP = 1000;
    const bestAvailableValue = bestRanked?.c.value;
    const candidateValue = cp.value;
    if (
      rankGap > 0 &&
      Number.isFinite(bestAvailableValue) &&
      Number.isFinite(candidateValue) &&
      (bestAvailableValue as number) - (candidateValue as number) > VALUE_OUT_OF_ORDER_MAX_GAP
    ) {
      return 0;
    }

    // FantasyCalc percentile tiers are the primary structure of the Community engine.
    // Players should generally stay inside the highest available tier, with
    // only a small amount of variance across an adjacent tier boundary.
    // Two or more tiers away is never a realistic pick, especially early.
    if (tierGap >= 2) return 0;

    // Within a tier, rank still matters, but the decline is deliberately
    // gentle so players grouped in the same FantasyCalc percentile tier can still move around.
    let weight = Math.exp(-Math.pow(rankGap / 3.8, 1.42));

    if (tierGap === 1) {
      // Crossing one tier is possible, but much less likely than staying in
      // the current tier. The penalty is intentionally sharp and becomes even
      // stronger as the rank gap grows.
      weight *= 0.035;
      weight *= Math.exp(-rankGap / 4.5);
    }

    // In the opening round, keep the engine especially close to the top FantasyCalc
    // tier. An adjacent-tier player can still jump the top tier, but only as
    // a genuine long shot.
    if (overallPick <= settings.teams && tierGap === 1) {
      weight *= 0.5;
    }

    // FantasyCalc value is secondary: it nudges close rankings without overpowering
    // the actual community rank/tier ordering.
    const maxValue = Math.max(
      ...availableCommunity.map((x) => x.c.value ?? 0),
      0
    );
    if (maxValue > 0 && (cp.value ?? 0) > 0) {
      weight *= 0.82 + 0.28 * Math.pow((cp.value ?? 0) / maxValue, 0.9);
    }

    if (settings.qbFormat === "SUPERFLEX" && p.position === "QB") weight *= 1.40;
    if (settings.qbFormat === "1QB" && p.position === "QB") weight *= 0.64;
    if (settings.teFormat === "TEP" && p.position === "TE") weight *= 1.16;

    return Math.max(weight, 0.000001);
  }

  const score = getScoreForFormat(p, settings.qbFormat, settings.teFormat);
  if (score === undefined) return 0;

  const scored = available
    .map((x) => ({
      p: x,
      rank: ddRankMap?.get(x.id) ?? getRankForFormat(x, settings.qbFormat, settings.teFormat) ?? 999999,
      score: getScoreForFormat(x, settings.qbFormat, settings.teFormat),
      tier: getTierForFormat(x, settings.qbFormat, settings.teFormat),
    }))
    .filter((x): x is { p: Prospect; rank: number; score: number; tier: Tier | undefined } => x.score !== undefined);

  if (!scored.length) return 0;

  const ranked = [...scored].sort((a, b) => a.rank - b.rank);
  const best = ranked[0];
  if (!best) return 0;

  const candidateRank = ddRankMap?.get(p.id) ?? getRankForFormat(p, settings.qbFormat, settings.teFormat) ?? 999999;
  const candidateTier = getTierForFormat(p, settings.qbFormat, settings.teFormat) ?? "Roster Clogger";
  const bestTier = best.tier ?? "Roster Clogger";
  const tierIndex = TIER_ORDER[candidateTier] ?? 99;
  const bestTierIndex = TIER_ORDER[bestTier] ?? 99;
  const tierGap = Math.max(0, tierIndex - bestTierIndex);
  const rankGap = Math.max(0, candidateRank - best.rank);
  const scoreGap = Math.max(0, best.score - score);

  // The DD board should mostly fall in rank order. Out-of-order picks are
  // reserved for a few nearby players with genuinely close scores.
  if (rankGap > 8) return 0;
  if (tierGap >= 2) return 0;
  if (tierGap === 1 && (rankGap > 2 || scoreGap > 2.0)) return 0;
  if (rankGap > 5 && scoreGap > 1.0) return 0;
  if (rankGap > 3 && scoreGap > 1.75) return 0;

  // Early picks are deliberately conservative: no huge board jumps.
  if (round === 1 && rankGap > 4) return 0;
  if (round === 1 && scoreGap > 10) return 0;
  if (scoreGap >= 20) return 0;

  // Rank is the primary signal; score closeness relaxes the rank penalty,
  // especially among players in the same tier.
  const rankWeight = Math.exp(-Math.pow(rankGap / 2.0, 1.38));
  const scoreWeight = Math.exp(-Math.pow(scoreGap / 3.4, 2.0));
  let weight = Math.pow(rankWeight, 0.72) * Math.pow(scoreWeight, 0.28);

  if (tierGap === 1) {
    // One-tier jumps are possible only as genuine long shots.
    weight *= 0.012;
    if (round === 1) weight *= 0.25;
  }

  if (settings.qbFormat === "SUPERFLEX" && p.position === "QB") weight *= 1.24;
  if (settings.qbFormat === "1QB" && p.position === "QB") weight *= 0.84;
  if (settings.teFormat === "TEP" && p.position === "TE") weight *= 1.08;

  return Math.max(weight, 0.000001);
}

export function weightedRandomPick(
  available: Prospect[],
  settings: MockSettings,
  community?: Map<string, CommunityPlayer>,
  overallPick = 1,
  ddRankMap?: Map<string, number>
): Prospect {
  const weighted = available
    .map((p) => ({ p, weight: getSelectionWeight(p, available, settings, community, overallPick, ddRankMap) }))
    .filter((x) => x.weight > 0);

  if (!weighted.length) {
    // Never let an empty weighting set fall back to an arbitrary player.
    // Use the selected board's best remaining player instead.
    if (settings.engine === "COMMUNITY") {
      const communityFallback = available
        .map((p) => ({ p, c: community?.get(normalizePlayerName(p.name)) }))
        .filter((x): x is { p: Prospect; c: CommunityPlayer } => !!x.c && Number.isFinite(x.c.rank))
        .sort((a, b) => a.c.rank - b.c.rank)[0];
      if (communityFallback) return communityFallback.p;
    }

    const ddFallback = [...available].sort((a, b) => {
      const ar = ddRankMap?.get(a.id) ?? getRankForFormat(a, settings.qbFormat, settings.teFormat) ?? 999999;
      const br = ddRankMap?.get(b.id) ?? getRankForFormat(b, settings.qbFormat, settings.teFormat) ?? 999999;
      return ar - br;
    })[0];
    if (!ddFallback) throw new Error("No available prospects to pick from.");
    return ddFallback;
  }

  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  let cursor = Math.random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.p;
  }

  return weighted[weighted.length - 1]?.p ?? weighted[0]!.p;
}

/**
 * Whether the current overall pick belongs to the synced user.
 * Extracted as a standalone, pure function (rather than staying
 * inline in MockDraftExperience.tsx) specifically to keep it
 * unit-testable in isolation — this exact class of logic (real pick
 * ownership vs. the simple single-slot model) has already had one
 * real, shipped bug this session, in the closely related
 * deriveManualEntryLimit below.
 *
 * Falls back to the simple "I always pick from this one slot" model
 * unless real pick order is active and has actually loaded —
 * userPickNumbers is the set of exact overall pick numbers that
 * belong to the synced user after real trades, which can be
 * non-contiguous across rounds in a way a single slot number can't
 * represent (own pick 1.05, traded away 2.05, acquired an extra pick
 * in round 3, etc).
 */
export function deriveIsUserTurn(
  currentOverall: number,
  currentSlot: number,
  slot: number,
  userPickNumbers: Set<number> | null
): boolean {
  return userPickNumbers ? userPickNumbers.has(currentOverall) : currentSlot === slot;
}

/**
 * How many picks the "Continue Existing Draft" manual-entry panel
 * lets someone fill in before switching to live simulation.
 *
 * Under the simple model this is always "up to my one fixed slot" —
 * with real order active it's "up to my FIRST owned pick" instead,
 * since that's the earliest point manual entry is actually needed
 * for. This is the exact fix for a real bug that shipped: without
 * it, the old slot-1 threshold could evaluate to 0 once real order
 * took over (slot stops being meaningfully set), which silently hid
 * the entire manual-entry panel rather than just computing a wrong
 * number.
 */
export function deriveManualEntryLimit(userPickNumbers: Set<number> | null, slot: number): number {
  return userPickNumbers && userPickNumbers.size > 0
    ? Math.max(0, Math.min(...userPickNumbers) - 1)
    : slot - 1;
}

export function formatPick(overall: number, teams: number): string {
  const round = Math.floor((overall - 1) / teams) + 1;
  const slot = ((overall - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export function getPickGrade(
  picked: Prospect,
  expectedScore: number | undefined,
  settings: MockSettings
): { grade: string; valueGain: number; scoreGap: number; tierGap: number } {
  const pickedScore = getScoreForFormat(picked, settings.qbFormat, settings.teFormat) ?? 0;
  const slotExpected = expectedScore ?? pickedScore;
  const valueGain = pickedScore - slotExpected;

  // Draft grades are based on value gained/lost relative to the DD value
  // expected at that exact draft slot. A+ requires meaningful value gained;
  // drafting exactly at slot value (0.0 gain) earns an A.
  const grade =
    valueGain >= 3 ? "A+" :
    valueGain >= 0 ? "A" :
    valueGain >= -1 ? "A-" :
    valueGain >= -2.5 ? "B+" :
    valueGain >= -4 ? "B" :
    valueGain >= -6 ? "B-" :
    valueGain >= -8 ? "C+" :
    valueGain >= -12 ? "C" :
    valueGain >= -16 ? "C-" :
    valueGain >= -20 ? "D" : "F";

  // Retain scoreGap for the existing results callout, but it now represents
  // the magnitude of value missed relative to the expected slot value.
  const scoreGap = Math.max(0, -valueGain);
  const tierGap = 0;
  return { grade, valueGain, scoreGap, tierGap };
}
