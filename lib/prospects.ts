import type { Position } from "@/types/prospect";
import { formatAdjustment } from "@/lib/formatAdjustment";
import type { LeagueFormat } from "@/lib/ddScore";
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
 *
 * Real, reported gap this closes: a drafted player's DD Score shifts
 * with the 1QB/Superflex/TEP toggle (a QB might go from 82 to 95),
 * but an undrafted/devy prospect's Pre-Draft Score used to stay
 * completely flat regardless of format — looked broken sitting next
 * to format-aware numbers everywhere else on the site. `format` is
 * optional and every existing caller that doesn't pass it keeps the
 * exact original, unadjusted behavior; only call sites that actually
 * have a format in scope (a page with the format toggle live) opt
 * into the adjusted version. The adjustment itself — formatAdjustment(),
 * imported from lib/formatAdjustment.ts — is the literal, unmodified
 * QB/TE point adjustment DD Score already uses; this isn't a new or
 * separate calibration, just the same one applied to a second score
 * that was never getting it.
 */
export function getDisplayedPreDraftScore(
  p: import("@/types/prospect").Prospect,
  format?: LeagueFormat
): number | undefined {
  // Any prospect who has not been drafted is still in the pre-draft regime.
  // This must follow hasDraftData rather than a hardcoded pair of class years:
  // when the sheet starts grading the next devy cycle, it should immediately
  // receive the same format-aware treatment without another code change.
  if (p.hasDraftData !== true) {
    if (p.preDraftScore === undefined) return undefined;
    if (format === undefined) return p.preDraftScore;
    return Math.max(0, Math.min(100, p.preDraftScore + formatAdjustment(p.position, format)));
  }
  const positional = p.positionalScore ?? p.grade?.overall;
  if (format === undefined) return positional;
  return positional === undefined
    ? undefined
    : Math.max(0, Math.min(100, positional + formatAdjustment(p.position, format)));
}
