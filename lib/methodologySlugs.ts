/**
 * Every position's sub-scores, in display order, matching what
 * actually shows on a player profile (lib/googleSheets.ts's
 * POSITION_METRICS, plus Draft Capital and Opportunity which are
 * computed separately). Used to build both the methodology page's
 * sections and the info-icon links from each sub-score ring.
 */
export const POSITION_SUBSCORES: Record<string, string[]> = {
  QB: ["Production", "Accuracy", "Ball Security", "Rushing", "Draft Capital", "Opportunity"],
  RB: ["Size", "Speed", "Receiving", "Age", "Draft Capital", "Opportunity"],
  WR: ["Production", "Dominator", "Breakout Age", "Size", "Draft Capital", "Opportunity"],
  TE: ["Production", "Volume", "Redzone Threat", "Athleticism", "Draft Capital", "Opportunity"],
};

export const METHODOLOGY_POSITIONS = Object.keys(POSITION_SUBSCORES);

/** Popup description text for each position's sub-scores. */
export const SUBSCORE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  QB: {
    Production: "A college QB's passing yards per game (min. 9 gp.)",
    Accuracy: "College completion percentage (min 9 gp.)",
    "Ball Security": "Percentage of passes thrown resulting in an INT.",
    Rushing: "A college QB's rushing yards per game (min. 9 gp.)",
    "Draft Capital": "How early did this player get drafted?",
    Opportunity: "A qualitative measure of a player's opportunity in the NFL.",
  },
  RB: {
    Size: "BMI",
    Speed: "40 yard dash (NFL Combine or Pro Day.)",
    Receiving: "Shows how effective a RB is at catching passes.",
    Age: "Age of the player at the time of their first NFL game.",
    "Draft Capital": "How early did this player get drafted?",
    Opportunity: "A qualitative measure of a player's opportunity in the NFL.",
  },
  WR: {
    Production: "How many receiving yards a player put up in their best year.",
    Dominator: "Percentage of receiving yards a player accounted for.",
    "Breakout Age": "Age a player was for their first 600 yard season.",
    // Deliberately not BMI, unlike RB's Size above — a taller
    // receiver should score higher than a shorter one at the same
    // weight, which a ratio-based BMI formula doesn't reflect. Height
    // and weight are each ranked by percentile against the rest of
    // the class independently, then averaged.
    Size: "Height and weight percentile among the class, blended together — not BMI.",
    "Draft Capital": "How early did this player get drafted?",
    Opportunity: "A qualitative measure of a player's opportunity in the NFL.",
  },
  TE: {
    Production: "How many receiving yards a player put up in their best year.",
    Volume: "How many targets a player commanded.",
    "Redzone Threat": "How many touchdowns this player scored.",
    Athleticism: "How athletic a player is relative to their size.",
    "Draft Capital": "How early did this player get drafted?",
    Opportunity: "A qualitative measure of a player's opportunity in the NFL.",
  },
};

/** Looks up a sub-score's description, with a generic fallback (e.g. for "Mock").
 *  Every real sub-score currently in POSITION_SUBSCORES has a real
 *  entry here (verified — this fallback is not currently reachable
 *  in practice), but kept honest rather than saying "placeholder"
 *  in case a future sub-score gets added here before its
 *  description is written. */
export function subScoreDescription(position: string, label: string): string {
  return (
    SUBSCORE_DESCRIPTIONS[position]?.[label] ??
    `A description for the ${label} score is on the way.`
  );
}

/** Stable anchor slug for a position + sub-score, e.g. "wr-breakout-age". */
export function subScoreSlug(position: string, label: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  return `${clean(position)}-${clean(label)}`;
}
