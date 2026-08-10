import type { Tier } from "@/types/prospect";

export interface TierDefinition {
  name: Tier;
  min: number; // inclusive lower bound on Prospect Score
  color: string; // hex
}

/**
 * The dynasty tier scale, ordered highest to lowest. Each tier's
 * range is [min, next tier's min).
 */
export const TIER_DEFINITIONS: TierDefinition[] = [
  { name: "Generational", min: 95, color: "#7C3AED" }, // royal purple
  { name: "Elite", min: 90, color: "#2563EB" }, // royal blue
  { name: "Starter", min: 85, color: "#16A34A" }, // base green
  { name: "Flex", min: 80, color: "#86EFAC" }, // light green
  { name: "Upside Shot", min: 75, color: "#EAB308" }, // yellow
  { name: "Bench", min: 70, color: "#FB923C" }, // light orange
  { name: "Taxi Squad", min: 60, color: "#EA580C" }, // base orange
  { name: "Roster Clogger", min: 0, color: "#DC2626" }, // base red
];

export const ALL_TIERS: Tier[] = TIER_DEFINITIONS.map((t) => t.name);

export function getTierColor(tier: Tier): string {
  return TIER_DEFINITIONS.find((t) => t.name === tier)?.color ?? "#5C6470";
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
