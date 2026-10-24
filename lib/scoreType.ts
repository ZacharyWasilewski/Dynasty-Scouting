import type { Prospect } from "@/types/prospect";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { scoreAtStage, SCORE_STAGE_LABELS, type ScoreStage } from "@/lib/scoreStage";

/**
 * The score a rankings list shows (and sorts by).
 *  - "auto" (default): each prospect's score at its current stage — DD Score
 *    once draft data exists, otherwise Pre-Draft (or Raw for early-watch
 *    classes). The UI always names the stage actually being shown.
 *  - any ScoreStage: that exact score, or "unavailable" when the prospect has
 *    none. An explicit choice is never silently swapped for another score.
 */
export type ScoreType = "auto" | ScoreStage;

export const SCORE_TYPE_OPTIONS: ScoreType[] = ["auto", "dd", "positional", "preDraft", "raw", "opportunity"];

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  auto: "Current-stage score",
  ...SCORE_STAGE_LABELS,
};

export function parseScoreType(value: string | null | undefined): ScoreType {
  return SCORE_TYPE_OPTIONS.includes(value as ScoreType) ? (value as ScoreType) : "auto";
}

/** Short stage tags for mixed-stage lists. */
export const STAGE_SHORT_LABELS: Record<"dd" | "preDraft" | "raw", string> = { dd: "DD", preDraft: "PD", raw: "Raw" };

/** The stage "auto" resolves to for one prospect. */
export function autoStageFor(p: Prospect, earlyWatchMode = false): "dd" | "preDraft" | "raw" {
  if (p.hasDraftData) return "dd";
  return earlyWatchMode ? "raw" : "preDraft";
}

/** Value shown/sorted for the selected score type in a rankings row. */
export function scoreForType(p: Prospect, type: ScoreType, format: LeagueFormat, earlyWatchMode = false): number | undefined {
  if (type === "auto") {
    const stage = autoStageFor(p, earlyWatchMode);
    if (stage === "dd") return getDDScore(p, format);
    if (stage === "raw") return scoreAtStage(p, "raw", format);
    return getDisplayedPreDraftScore(p, format);
  }
  return scoreAtStage(p, type, format);
}

/**
 * Header/selector wording for a set of prospects under a score type.
 * Derived from the full (unfiltered) list so labels stay stable when filters
 * produce zero results.
 */
export function describeScoreType(
  prospects: Prospect[],
  type: ScoreType,
  earlyWatchMode = false
): { columnLabel: string; mixed: boolean; stagesShown: ("dd" | "preDraft" | "raw")[] } {
  if (type !== "auto") return { columnLabel: SCORE_TYPE_LABELS[type], mixed: false, stagesShown: [] };
  const stages = new Set<"dd" | "preDraft" | "raw">();
  for (const p of prospects) stages.add(autoStageFor(p, earlyWatchMode));
  const list = [...stages];
  if (list.length === 1) return { columnLabel: SCORE_STAGE_LABELS[list[0]!], mixed: false, stagesShown: list };
  if (list.length === 0) return { columnLabel: SCORE_TYPE_LABELS.auto, mixed: false, stagesShown: [] };
  return { columnLabel: "Score (by stage)", mixed: true, stagesShown: list };
}
