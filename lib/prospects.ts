import type { Position } from "@/types/prospect";
export { ALL_TIERS } from "@/lib/tiers";

/**
 * Static filter option lists. This file only holds option lists
 * that don't change with the data — every position graded and
 * tracked on this site. The dynasty tier scale lives in lib/tiers.ts.
 */

export const ALL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

/**
 * Display value for the legacy "Pre-Draft Score" slot. Once a player has
 * both real ADP and OPP data, the site treats the Positional Score as the
 * current score in that slot instead of continuing to display the obsolete
 * pre-draft number. Future/pre-draft players continue to use Pre-Draft Score.
 */
export function getDisplayedPreDraftScore(p: import("@/types/prospect").Prospect): number | undefined {
  // The ranking tables intentionally show the forward-looking Pre-Draft Score
  // only for the 2027 and 2028 classes. Every completed/historical class uses
  // the model's final Positional Score. This is based ONLY on draft class, so
  // missing ADP/OPP rows can never cause an old player to fall back to a
  // pre-draft number.
  if (p.draftClass === "2027" || p.draftClass === "2028") {
    return p.preDraftScore;
  }
  return p.positionalScore ?? p.grade?.overall;
}
