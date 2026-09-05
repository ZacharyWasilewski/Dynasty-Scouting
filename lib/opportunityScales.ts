export type OpportunityPosition = "QB" | "RB" | "WR" | "TE";

export interface PositionOpportunityScale {
  /** Ordered worst -> best, matching the sheet's own Tier 1..N order. */
  multipliers: Record<string, number>;
  /** The OPP block's own "Category Weight" cell — the point value a
   *  full-multiplier tier contributes to the positional score. */
  opportunityWeight: number;
}

/**
 * Transcribed directly from the Weight Scales tab.
 *
 * These exist so the feature works even when the live parse fails. The
 * parser in lib/googleSheets.ts overwrites any position it successfully
 * reads, so editing the sheet still flows through automatically — this is
 * a floor, not a replacement. It's deliberately explicit rather than
 * clever: a wrong multiplier here would silently produce a wrong score,
 * so every value is a literal copy of a sheet cell.
 */
export const DEFAULT_OPPORTUNITY_SCALES: Record<OpportunityPosition, PositionOpportunityScale> = {
  QB: {
    multipliers: { DEPTH: 0, QB2H: 0.1, QB2P: 0.5, MEN: 0.8, QB1: 1 },
    opportunityWeight: 13,
  },
  RB: {
    multipliers: { DEPTH: 0, RB2H: 0.34, RB2P: 0.5, COM: 0.64, RB1: 1 },
    opportunityWeight: 17,
  },
  WR: {
    multipliers: { DEPTH: 0.1, WR2: 0.4, WR2U: 0.65, COM: 0.75, WR1: 1 },
    opportunityWeight: 25,
  },
  TE: {
    multipliers: { DEPTH: 0.1, COM: 0.5, TE1: 1 },
    opportunityWeight: 16,
  },
};

/** Display order for each position's options, best role first. */
export const OPPORTUNITY_OPTIONS_BY_POSITION: Record<OpportunityPosition, readonly string[]> = {
  QB: ["QB1", "MEN", "QB2P", "QB2H", "DEPTH"],
  RB: ["RB1", "COM", "RB2P", "RB2H", "DEPTH"],
  WR: ["WR1", "COM", "WR2U", "WR2", "DEPTH"],
  TE: ["TE1", "COM", "DEPTH"],
};

export const OPPORTUNITY_POSITIONS: OpportunityPosition[] = ["QB", "RB", "WR", "TE"];

/** Strips spacing/punctuation so "WR 2U", "WR-2U" and "WR2U" all match. */
export function normalizeOpportunityLabel(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
