import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { getDDScore, getDDTier, type LeagueFormat } from "@/lib/ddScore";
import { getTierForScore } from "@/lib/tiers";
import type { Prospect, Tier } from "@/types/prospect";

/**
 * Dynasty rookie drafts are shown on a standard 12-team, four-round board.
 * The projection intentionally uses class rank for the center of the range,
 * then uses the player's current tier to show how far that tier stretches
 * within the class. That means the projection moves when the active league
 * format changes QB/TE value, instead of being a static label.
 */
export const PICKS_PER_ROUND = 12;
export const PROJECTED_DRAFT_ROUNDS = 4;
export const PROJECTED_DRAFT_PICK_LIMIT = PICKS_PER_ROUND * PROJECTED_DRAFT_ROUNDS;

export interface DraftProjectionResult {
  label: string;
  rangeLabel: string;
  expectedPick?: string;
  rank?: number;
  tier?: Tier;
  tierStartRank?: number;
  tierEndRank?: number;
  classSize: number;
  tierWindowSize?: number;
  isOutsideDraftableRange: boolean;
}

function projectionScore(prospect: Prospect, format: LeagueFormat): number | undefined {
  if (prospect.hasDraftData === true) return getDDScore(prospect, format);
  return applyFormatAdjustment(prospect.preDraftScore, prospect.position, format);
}

function projectionTier(
  prospect: Prospect,
  format: LeagueFormat,
  score: number | undefined
): Tier | undefined {
  if (prospect.hasDraftData === true) return getDDTier(prospect, format) ?? getTierForScore(score);
  return getTierForScore(score);
}

export function formatDraftPick(rank: number): string | undefined {
  if (!Number.isFinite(rank) || rank < 1 || rank > PROJECTED_DRAFT_PICK_LIMIT) return undefined;
  const round = Math.ceil(rank / PICKS_PER_ROUND);
  const pick = ((rank - 1) % PICKS_PER_ROUND) + 1;
  return `${round}.${String(pick).padStart(2, "0")}`;
}

function labelForRank(rank: number): string {
  if (rank > PROJECTED_DRAFT_PICK_LIMIT) return "Waiver Wire";

  const round = Math.ceil(rank / PICKS_PER_ROUND);
  const posInRound = ((rank - 1) % PICKS_PER_ROUND) + 1;
  const segment = posInRound <= 4 ? "Early" : posInRound <= 8 ? "Mid" : "Late";
  return `${segment} Round ${round}`;
}

/**
 * Computes a format-aware rookie draft projection.
 *
 * Center: the player's current class rank in the selected format.
 * Range: the first and last class ranks occupied by that same tier.
 *
 * Example: a player ranked 9th whose tier spans ranks 7–14 projects as
 * Late Round 1, with a tier-based range of 1.07–2.02.
 */
export function computeDraftProjection(
  prospect: Prospect,
  allProspects: Prospect[],
  format: LeagueFormat
): DraftProjectionResult {
  const prospectScore = projectionScore(prospect, format);
  if (!prospect.draftClass || prospectScore === undefined) {
    return {
      label: "Unranked",
      rangeLabel: "Projection unavailable",
      classSize: 0,
      isOutsideDraftableRange: false,
    };
  }

  const classmates = allProspects
    .filter((p) => p.draftClass === prospect.draftClass)
    .map((p) => ({ prospect: p, score: projectionScore(p, format) }))
    .filter((entry): entry is { prospect: Prospect; score: number } => entry.score !== undefined)
    .sort((a, b) => b.score - a.score || a.prospect.name.localeCompare(b.prospect.name));

  const rankIndex = classmates.findIndex((entry) => entry.prospect.id === prospect.id);
  if (rankIndex === -1) {
    return {
      label: "Unranked",
      rangeLabel: "Projection unavailable",
      classSize: classmates.length,
      isOutsideDraftableRange: false,
    };
  }

  const rank = rankIndex + 1;
  const tier = projectionTier(prospect, format, prospectScore);
  const tierRanks = tier
    ? classmates
        .map((entry, index) => ({ index: index + 1, tier: projectionTier(entry.prospect, format, entry.score) }))
        .filter((entry) => entry.tier === tier)
        .map((entry) => entry.index)
    : [];

  const tierStartRank = tierRanks[0] ?? rank;
  const tierEndRank = tierRanks[tierRanks.length - 1] ?? rank;
  const expectedPick = formatDraftPick(rank);
  const rangeStartPick = formatDraftPick(tierStartRank);
  const rangeEndPick = formatDraftPick(tierEndRank);
  const isOutsideDraftableRange = rank > PROJECTED_DRAFT_PICK_LIMIT;

  let rangeLabel: string;
  if (isOutsideDraftableRange) {
    rangeLabel = tierStartRank <= PROJECTED_DRAFT_PICK_LIMIT
      ? `${formatDraftPick(tierStartRank)}–4.12+`
      : "Outside the top 48";
  } else if (rangeStartPick && rangeEndPick) {
    rangeLabel = rangeStartPick === rangeEndPick ? rangeStartPick : `${rangeStartPick}–${rangeEndPick}`;
  } else if (rangeStartPick) {
    rangeLabel = `${rangeStartPick}–4.12+`;
  } else {
    rangeLabel = "Outside the top 48";
  }

  return {
    label: labelForRank(rank),
    rangeLabel,
    expectedPick,
    rank,
    tier,
    tierStartRank,
    tierEndRank,
    classSize: classmates.length,
    tierWindowSize: tierEndRank - tierStartRank + 1,
    isOutsideDraftableRange,
  };
}

/** Backward-compatible helper for callers that only need the headline. */
export function computeDraftProjectionLabel(
  prospect: Prospect,
  allProspects: Prospect[],
  format: LeagueFormat = "SUPERFLEX"
): string {
  return computeDraftProjection(prospect, allProspects, format).label;
}
