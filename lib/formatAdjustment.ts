import type { LeagueFormat } from "@/lib/ddScore";

// Extracted from lib/ddScore.ts, verbatim — not a new or changed
// calibration, just moved so it can be reused by lib/prospects.ts
// for the devy Pre-Draft Score adjustment (see getDisplayedPreDraftScore)
// without creating a circular import: lib/analytics.ts already
// imports getDisplayedPreDraftScore from lib/prospects.ts, and
// lib/ddScore.ts imports from lib/analytics.ts, so lib/prospects.ts
// importing a runtime value directly from lib/ddScore.ts would have
// closed that loop. This file has no dependency on either of them at
// runtime — its only reference to lib/ddScore.ts is a type-only
// import (LeagueFormat), which TypeScript erases at compile time and
// never becomes an actual runtime import.
const QB_ADJUSTMENT: Record<LeagueFormat, number> = {
  "1QB": -7,
  "1QB_TEP": -7,
  SUPERFLEX: 9,
  "SUPERFLEX_TEP": 9,
};

// TE value is intentionally identical between 1QB and Superflex.
// TEP is its own toggle; with TEP on, TE gets no boost or penalty
// relative to baseline (0), versus the -3 penalty when TEP is off.
const TE_ADJUSTMENT: Record<LeagueFormat, number> = {
  "1QB": -4,
  "1QB_TEP": -1,
  SUPERFLEX: -4,
  "SUPERFLEX_TEP": -1,
};

export function formatAdjustment(position: string, format: LeagueFormat): number {
  if (position === "QB") return QB_ADJUSTMENT[format];
  if (position === "TE") return TE_ADJUSTMENT[format];
  return 0;
}

/**
 * Applies the same QB/TE format adjustment to any raw 0–100 score,
 * clamped back into range — a general-purpose version, not tied to
 * getDisplayedPreDraftScore's ranking-table-specific branching (that
 * function applies its adjustment only when the prospect is still
 * undrafted, since it exists to decide what a ranking table should
 * display; calling it on an arbitrary historical prospect would use a
 * different score, its Positional Score, instead. Use this whenever
 * a raw score value (Pre-Draft Score, Positional Score, Opportunity-
 * Independent Score, Raw Score) needs the format adjustment applied
 * directly, independent of any display-context rules.
 */
export function applyFormatAdjustment(
  rawScore: number | undefined,
  position: string,
  format: LeagueFormat
): number | undefined {
  if (rawScore === undefined) return undefined;
  return Math.max(0, Math.min(100, rawScore + formatAdjustment(position, format)));
}
