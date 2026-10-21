import type { Prospect } from "@/types/prospect";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
export type ScoreStage = "raw" | "preDraft" | "positional" | "opportunity" | "dd";
export function scoreAtStage(p: Prospect, stage: ScoreStage, format: LeagueFormat): number | undefined {
  if (stage === "dd") return p.hasDraftData === true ? getDDScore(p, format) : undefined;
  const value = stage === "raw" ? p.rawScore : stage === "preDraft" ? p.preDraftScore : stage === "opportunity" ? p.opportunityScore : p.grade?.overall ?? p.positionalScore;
  return applyFormatAdjustment(value, p.position, format);
}
export function sharedScoreStage(a: Prospect, b: Prospect): ScoreStage {
  if (a.hasDraftData === true && b.hasDraftData === true) return "dd";
  if (Number.isFinite(a.preDraftScore) && Number.isFinite(b.preDraftScore)) return "preDraft";
  return "raw";
}
export const SCORE_STAGE_LABELS: Record<ScoreStage, string> = { raw: "Raw Score", preDraft: "Pre-Draft Score", positional: "Positional Score", opportunity: "O.I.S. Score", dd: "DD Score" };

/** The score used by the player profile (2028 remains Raw-only). */
export function playerScoreStage(p: Prospect, context: "profile" | "mock" = "profile"): "dd" | "preDraft" | "raw" {
  if (p.hasDraftData === true) return "dd";
  if (context === "mock") return "preDraft"; // Mock rooms do not display Raw scores.
  return p.draftClass === "2028" || !Number.isFinite(p.preDraftScore) ? "raw" : "preDraft";
}
export function tierHistoryLabel(p: Prospect, context: "profile" | "mock" = "profile"): string {
  const stage = playerScoreStage(p, context);
  return stage === "dd" ? "DD" : stage === "preDraft" ? "Pre-Draft" : "Raw";
}
