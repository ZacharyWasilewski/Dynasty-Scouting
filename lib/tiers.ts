import type { Tier } from "@/types/prospect";

export interface TierDefinition {
  name: Tier;
  min: number; // inclusive lower bound on the score
  color: string; // hex
}

/**
 * The dynasty tier scale, ordered highest to lowest. Each tier's
 * range is [min, next tier's min).
 */
export const TIER_DEFINITIONS: TierDefinition[] = [
  { name: "Generational", min: 95, color: "#7C3AED" }, // royal purple
  { name: "Elite", min: 84, color: "#2563EB" }, // royal blue
  // Starter and Roster Clogger below share their color with
  // --color-riser/--color-faller, which were separately found to fail
  // WCAG's 4.5:1 normal-text minimum against the light theme's
  // background (riser 3.07:1, faller 4.51:1 with no margin) - missed
  // in the earlier Flex/Upside Shot/Bench pass since neither had an
  // existing comment flagging them. Deepened to match the tokens'
  // corrected values (riser fix 4.68:1, faller fix 6.04:1) rather
  // than picking new one-off colors.
  { name: "Starter", min: 74, color: "#15803D" }, // matches deepened riser
  // Flex and Upside Shot were adjusted from their original values —
  // #86EFAC (a pale mint green) and #EAB308 (a bright yellow) were
  // tuned to glow against near-black, but TierBadge uses this exact
  // color as actual small text (11px), used across the entire site
  // (every ranking table, every player card) — both had real
  // readability problems as text directly on the new light
  // background. Deepened within the same hue family rather than
  // changed to a different color, so "green means Flex" / "yellow
  // means Upside Shot" still holds.
  //
  // Upside Shot's first deepened value (#B7860B) computed to only
  // 3.05:1 against the light background — clears WCAG's 3:1 large-text
  // floor but not the 4.5:1 this 11px badge text actually needs.
  // Recomputed and deepened further to #8A6608 (4.92:1).
  { name: "Flex", min: 63, color: "#3F8F5F" }, // deepened green
  { name: "Upside Shot", min: 53, color: "#C99700" }, // brighter gold/yellow
  // Same problem as Flex/Upside Shot above, missed in that pass:
  // #FB923C computes to 2.11:1 against the light theme's background
  // (--color-void #F6F7F9), well under WCAG AA's 3:1 floor even for
  // large text, let alone 4.5:1 for the 11px badge text this is
  // actually rendered as. Deepened within the same orange hue to
  // #A85A0F (4.74:1, passes normal text) — chosen to still read as
  // visibly paler/less saturated than Taxi Squad's base orange below,
  // preserving the original "light orange" intent now that it's
  // actually legible.
  { name: "Bench", min: 42, color: "#A85A0F" },
  { name: "Taxi Squad", min: 30, color: "#EA580C" }, // base orange
  { name: "Roster Clogger", min: 0, color: "#B91C1C" }, // matches deepened faller
];

export const ALL_TIERS: Tier[] = TIER_DEFINITIONS.map((t) => t.name);

export function getTierColor(tier: Tier): string {
  // The fallback here is effectively unreachable — tier is typed to
  // one of the 8 real names above, so .find() always succeeds in
  // practice. Kept as a CSS variable reference anyway, consistent
  // with everywhere else a color needs to resolve correctly whether
  // it's rendered in a light-default or .theme-dark scoped context.
  return TIER_DEFINITIONS.find((t) => t.name === tier)?.color ?? "var(--color-ink-tertiary)";
}

/** Derive a prospect's tier from their Prospect Score. */
export function getTierForScore(score: number | undefined): Tier | undefined {
  if (score === undefined) return undefined;
  for (const t of TIER_DEFINITIONS) {
    if (score >= t.min) return t.name;
  }
  return undefined;
}



/**
 * Positional Score tiers used exclusively for historical position-page
 * hit-rate analysis. These intentionally retain the original positional
 * calibration bands and are different from the newer DD Score tiers.
 */
export const POSITIONAL_TIER_DEFINITIONS: TierDefinition[] = [
  { name: "Generational", min: 95, color: "#7C3AED" },
  { name: "Elite", min: 90, color: "#2563EB" },
  { name: "Starter", min: 85, color: "#15803D" }, // see TIER_DEFINITIONS above
  { name: "Flex", min: 80, color: "#3F8F5F" },
  { name: "Upside Shot", min: 75, color: "#C99700" }, // see TIER_DEFINITIONS above
  { name: "Bench", min: 70, color: "#A85A0F" }, // see TIER_DEFINITIONS above for the contrast fix reasoning
  { name: "Taxi Squad", min: 60, color: "#EA580C" },
  { name: "Roster Clogger", min: 0, color: "#B91C1C" }, // see TIER_DEFINITIONS above
];

export function getPositionalTierForScore(score: number | undefined): Tier | undefined {
  if (score === undefined) return undefined;
  for (const t of POSITIONAL_TIER_DEFINITIONS) {
    if (score >= t.min) return t.name;
  }
  return undefined;
}

/**
 * The Opportunity sub-score is a text label (e.g. "QB1", "DEPTH"),
 * not a percentile — but each label still maps to a tier color, on
 * the same visual scale as everything else on the site.
 */
const OPPORTUNITY_TIER: Record<"QB" | "RB" | "WR" | "TE", Record<string, Tier>> = {
  QB: { QB1: "Starter", MEN: "Flex", QB2P: "Upside Shot", QB2H: "Taxi Squad", DEPTH: "Roster Clogger" },
  RB: { RB1: "Starter", COM: "Flex", RB2P: "Upside Shot", RB2H: "Taxi Squad", DEPTH: "Roster Clogger" },
  WR: { WR1: "Starter", COM: "Flex", WR2U: "Upside Shot", WR2: "Taxi Squad", DEPTH: "Roster Clogger" },
  TE: { TE1: "Starter", COM: "Upside Shot", DEPTH: "Roster Clogger" },
};

export function getOpportunityColor(position: string, label: string | undefined): string | undefined {
  if (!label) return undefined;
  const table = OPPORTUNITY_TIER[position as "QB" | "RB" | "WR" | "TE"];
  if (!table) return undefined;
  const tier = table[label.trim().toUpperCase()];
  return tier ? getTierColor(tier) : undefined;
}

/**
 * A short, plain-language read of a single percentile sub-score
 * (Size: 89, Speed: 91, etc). Deliberately a separate, simpler scale
 * from the 8-tier system above — an individual sub-score isn't an
 * overall grade, so labeling it with tier names like "Taxi Squad"
 * would mix two different scales and mean something confusing here.
 * This is a plain-language translation of an existing percentile
 * number, not a new invented metric.
 */
export function qualitativeLabelForPercentile(value: number): string {
  if (value >= 90) return "Elite";
  if (value >= 75) return "Excellent";
  if (value >= 60) return "Above Average";
  if (value >= 40) return "Average";
  if (value >= 25) return "Below Average";
  return "Weak";
}
