import type { Prospect } from "@/types/prospect";
import { applyDDScores } from "@/lib/ddScore";
import { getScoreForFormat } from "@/lib/mockDraft";

export type OpportunityScale = Record<string, Record<string, number>>;

export interface OpportunityOverrideResult {
  positionalScore: number;
  ddScore: number;
}

/**
 * Swaps only the Opportunity term of a player's score, then re-runs the
 * normal DD Score pipeline on the result.
 *
 * Nothing else about the model is recomputed or re-derived — every other
 * category's contribution is inherited from the official Positional
 * Score, so selecting a player's existing official label is a true no-op
 * that returns their unchanged score.
 *
 * The values under TE1/COM/etc. in Weight Scales are multipliers, not
 * points, so the one thing this needs is how many points a full unit of
 * multiplier is worth. See the derivation below — it prefers the
 * player's own sheet numbers over any assumption about weight totals.
 */
export function scoreWithOpportunityOverride(
  prospects: Prospect[],
  prospectId: string,
  opportunity: string,
  scales: OpportunityScale,
  opportunityWeight: number | undefined,
  format: "1QB" | "1QB_TEP" | "SUPERFLEX" | "SUPERFLEX_TEP" = "SUPERFLEX"
): OpportunityOverrideResult | undefined {
  const target = prospects.find((p) => p.id === prospectId);
  const officialPositionalScore = target?.positionalScore ?? target?.grade?.overall;
  if (!target || officialPositionalScore === undefined) return undefined;

  const normalize = (value: string | undefined) =>
    (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const resolveScale = (position: string, label: string): number | undefined => {
    const wanted = normalize(label);
    const entries = Object.entries(scales[position] ?? {});
    const match = entries.find(([key]) => normalize(key) === wanted);
    return match?.[1];
  };

  const officialOpportunity = target.subScores?.find(
    (s) => normalize(s.label) === "OPPORTUNITY"
  )?.text;
  if (!officialOpportunity || officialOpportunity === "—") return undefined;

  // Selecting the player's current official opportunity is a true no-op. It
  // must never depend on the Weight Scales fetch succeeding, because no model
  // input is actually changing.
  if (normalize(opportunity) === normalize(officialOpportunity)) {
    const currentScore = getScoreForFormat(
      target,
      format === "SUPERFLEX" || format === "SUPERFLEX_TEP" ? "SUPERFLEX" : "1QB",
      format.endsWith("TEP") ? "TEP" : "STANDARD"
    );
    if (currentScore === undefined) return undefined;
    return { positionalScore: officialPositionalScore, ddScore: currentScore };
  }

  const oldMultiplier = resolveScale(target.position, officialOpportunity);
  const newMultiplier = resolveScale(target.position, opportunity);
  if (oldMultiplier === undefined || newMultiplier === undefined) return undefined;

  if (!Number.isFinite(oldMultiplier) || !Number.isFinite(newMultiplier)) return undefined;

  // The Opportunity category weight IS the point value on the 0-100
  // positional score — the tier multiplier scales it directly. A QB1
  // (multiplier 1) contributes the full 13 points of QB's Opportunity
  // weight; DEPTH (multiplier 0) contributes 0, a 13 point swing.
  //
  // This is deliberately NOT divided by the position's total category
  // weight. An earlier version did that, and separately tried to infer
  // the scale from the Prospect Score / O.I.S. gap; both understated
  // the swing badly and are gone.
  const weight = Number(opportunityWeight);
  if (!Number.isFinite(weight) || weight <= 0) return undefined;

  // Only the opportunity term moves. Every other category's
  // contribution carries over from the official score untouched.
  const oldContribution = weight * oldMultiplier;
  const newContribution = weight * newMultiplier;
  const positionalScore = Math.max(0, Math.min(100, officialPositionalScore - oldContribution + newContribution));

  const clone = prospects.map((p) => ({
    ...p,
    grade: p.grade ? { ...p.grade } : p.grade,
    subScores: p.subScores ? p.subScores.map((s) => ({ ...s })) : p.subScores,
  }));
  const adjusted = clone.find((p) => p.id === prospectId);
  if (!adjusted) return undefined;

  if (!adjusted.grade) {
    adjusted.grade = {
      film: adjusted.rawScore ?? positionalScore,
      production: adjusted.preDraftScore ?? positionalScore,
      measurables: positionalScore,
      overall: positionalScore,
    };
  } else {
    adjusted.grade.overall = positionalScore;
  }
  adjusted.positionalScore = positionalScore;

  // DD calibration is always run after the new Positional Score is built.
  applyDDScores(clone);
  const ddScore = getScoreForFormat(
    adjusted,
    format === "SUPERFLEX" || format === "SUPERFLEX_TEP" ? "SUPERFLEX" : "1QB",
    format.endsWith("TEP") ? "TEP" : "STANDARD"
  );
  if (ddScore === undefined) return undefined;

  return { positionalScore, ddScore };
}
