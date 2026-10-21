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

/** A named sub-classification within a sub-score's methodology
 *  explanation — currently only QB's Opportunity uses this (QB1,
 *  MEN, QB2P, QB2H, DEPTH), but kept generic so another position's
 *  Opportunity section could reuse the same nested-list treatment
 *  later without a new data shape. */
export interface MethodologyClassification {
  label: string;
  description: string;
}

export interface MethodologySubscoreContent {
  text: string;
  classifications?: MethodologyClassification[];
}

export interface MethodologyPositionContent {
  intro: string;
  subscores: Partial<Record<string, MethodologySubscoreContent>>;
}

/**
 * Long-form Methodology-page content — deliberately separate from
 * both getPositionTheme()'s `description` (a short tagline reused on
 * the actual position browsing pages, e.g. "Draft capital is king")
 * and SUBSCORE_DESCRIPTIONS above (short tooltip text reused on
 * player profiles' score-ring info icons and mock draft/board
 * cards). Overwriting either of those with paragraph-length text
 * would have made a compact tooltip or a position page's hero tagline
 * unreasonably long everywhere else they're used. This is read only
 * by the Methodology page itself, which falls back to those shorter,
 * shared strings for any position/sub-score not yet given long-form
 * content here — so this only ever ADDS Methodology-page content,
 * it can't regress anything else on the site.
 */
export const METHODOLOGY_CONTENT: Partial<Record<string, MethodologyPositionContent>> = {
  QB: {
    intro:
      "Depending on your league format, quarterback can be either the most or least important position on your roster. It's also the hardest position to evaluate. NFL teams hardly seem to get it right, so we won't try to get fancy and beat them at their own game. Draft Capital is by far the biggest factor in the Dynasty Database model, with a few basic metrics layered on top to create a more balanced score.",
    subscores: {
      Production: {
        text: "Measures how many passing yards per game a college quarterback was responsible for during the best qualifying season of their career. A quarterback must have played a minimum of 9 games during the season to qualify.",
      },
      Accuracy: {
        text: "Uses the best completion percentage recorded across a full season for each quarterback. Extreme accuracy isn't necessary for a quarterback to succeed, but this helps filter out players who were particularly inefficient in college.",
      },
      "Ball Security": {
        text: "Measures the percentage of passes that resulted in an interception during a quarterback's best season. A quarterback doesn't need to be overly conservative with the football to succeed, but excessive turnovers can hurt job security at the next level.",
      },
      Rushing: {
        text: "Since the top fantasy quarterbacks tend to provide significant value as runners, this measures how many rushing yards a quarterback averaged per game in college. Because college statistics count sacks as negative rushing yards, those are factored into this calculation.",
      },
      "Draft Capital": {
        text: "An NFL quarterback's likelihood of succeeding drops significantly when they aren't selected in the first round. Draft Capital is therefore the largest factor in the QB model and helps separate productive college quarterbacks who receive significant NFL investment from those who don't.",
      },
      Opportunity: {
        text: "A qualitative measure of a player's opportunity entering their NFL career. This considers the player's situation and the path available to them for earning meaningful playing time.",
        classifications: [
          { label: "QB1", description: "A surefire starting quarterback in the NFL for at least a few seasons." },
          { label: "MEN", description: "Will likely sit a year or more before getting a starting opportunity, but has the draft capital to suggest a strong likelihood of becoming a starter." },
          { label: "QB2P", description: "A later-round QB who will start his career sitting behind a subpar NFL quarterback." },
          { label: "QB2H", description: "A later-round QB who should win the backup job, but has a top NFL quarterback in front of him." },
          { label: "DEPTH", description: "A player who is unlikely to see a meaningful opportunity on an NFL field." },
        ],
      },
    },
  },
};
