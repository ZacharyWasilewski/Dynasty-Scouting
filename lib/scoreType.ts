import type { Prospect } from "@/types/prospect";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { scoreAtStage, SCORE_STAGE_LABELS, type ScoreStage } from "@/lib/scoreStage";

/**
 * The score a rankings list shows (and sorts by) in place of the default
 * DD Score column. "dd" keeps the long-standing behavior; every other
 * option reuses scoreAtStage so the numbers match the player profile.
 */
export type ScoreType = ScoreStage;

export const SCORE_TYPE_OPTIONS: ScoreType[] = ["dd", "positional", "preDraft", "raw", "opportunity"];

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = SCORE_STAGE_LABELS;

export function parseScoreType(value: string | null | undefined): ScoreType {
  return SCORE_TYPE_OPTIONS.includes(value as ScoreType) ? (value as ScoreType) : "dd";
}

/** Value shown/sorted for the selected score type in a rankings row. */
export function scoreForType(p: Prospect, type: ScoreType, format: LeagueFormat): number | undefined {
  if (type === "dd") {
    return p.hasDraftData ? getDDScore(p, format) : getDisplayedPreDraftScore(p, format);
  }
  return scoreAtStage(p, type, format);
}
