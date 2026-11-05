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
  RB: {
    intro:
      "After it seemed like NFL teams were done with runningbacks, we went right back to the golden age. Runningbacks have never been worth more in your dynasty leagues, and Dynasty Database will help you create value by identifying which backs you should draft.",
    subscores: {
      Size: {
        text: "Historically, running backs above a 30 BMI have achieved more success at the NFL level. Size is starting to become a bit less important in today's NFL, but bigger is almost always better.",
      },
      Speed: {
        text: "A slow runningback isn't a death sentence, but this helps weed out the guys who can never create breakaway runs at the next level. You don't have to be a track star, but speed-size combinations are very important when scoring a prospect.",
      },
      Receiving: {
        text: "This tracks how much of the receiving offense a runningback was responsible for in college. Since PPR formats are the most popular, runningbacks who can catch passes are highly coveted in dynasty leagues.",
      },
      Age: {
        text: "Similar to size, runningbacks who start their NFL career at age 22 or younger have historically had higher rates of success at the next level. Elite talent will usually declare early, even in today's age of NIL, and this is reflected in the DD Score.",
      },
      "Draft Capital": {
        text: "A first-round NFL runningback has an extremely high chance of hitting, and a Day 2 pick also reflects a heavy investment into the position. After this, opportunity becomes much more important when analyzing a runningback prospect.",
      },
      Opportunity: {
        text: "This is a qualitative measure of a player's opportunity going into their NFL career.",
        classifications: [
          { label: "RB1", description: "A bellcow back in the NFL who will receive the large majority of carries in their offense." },
          { label: "COM", description: "A committee back will split time close to 50/50 with another rookie or veteran player, and could eventually take over if the other back fades out of the offense." },
          { label: "RB2P", description: "A runningback stuck behind an NFL starter who could be replaced if they don't perform up to standard. RB2P players are usually Day 2 or early Day 3 picks sitting behind fading veterans." },
          { label: "RB2H", description: "This kind of back is stuck behind a top-end runningback in the NFL, but faces no real competition for the handcuff spot." },
          { label: "DEPTH", description: "This player likely won't see much real opportunity on an NFL field without injuries or major changes ahead of them." },
        ],
      },
    },
  },
  WR: {
    intro:
      "A great wideout is the cornerstone of almost every great dynasty team. Receivers have been near the top of dynasty rankings for years, and it feels like elite prospects are coming out in almost every rookie class. Dynasty Database will help you separate which guys have the best chance to create elite value for your squad.",
    subscores: {
      Production: {
        text: "Production is one of the most important pre-draft metrics when analyzing a wide receiver. This measures how many receiving yards a wide receiver put up in the best season of their college career.",
      },
      Dominator: {
        text: "Dominator is used to give some context to a receiver's production. Production alone can't account for the offense a player is in or how often that team throws the ball, which can make raw receiving totals a little misleading. Dominator helps show how much of their team's receiving production a player was actually responsible for.",
      },
      "Breakout Age": {
        text: "This tracks how old a wide receiver was during their first college season with at least 600 receiving yards. The younger a player is when they break out, the better their chances have historically been of succeeding at the next level.",
      },
      Size: {
        text: "This is becoming less important in today's NFL, but it still matters. This metric simply tracks the size of a wide receiver prospect and rewards players who fall into historically successful size ranges without making it impossible for smaller receivers to score well.",
      },
      "Draft Capital": {
        text: "While being a first-round pick gives a receiver a much better chance of hitting at the NFL level, the position can still be a bit of a crapshoot. High draft capital becomes even more meaningful when it is paired with strong production and a good opportunity grade.",
      },
      Opportunity: {
        text: "This is a qualitative measure of a player's opportunity going into their NFL career.",
        classifications: [
          { label: "WR1", description: "A receiver who walks into an offense with a clear path to becoming the top target on their team." },
          { label: "COM", description: "A committee wide receiver will split targets fairly evenly with another receiver, or in some cases a tight end, on their NFL team." },
          { label: "WR2U", description: "This is usually a later-round wide receiver who starts behind a player that isn't completely locked into their role, giving them a real opportunity to earn more targets with good play." },
          { label: "WR2", description: "A wide receiver who will likely be consistently out-targeted by a top-level wideout on their team, with a limited path to becoming the main target in the offense." },
          { label: "DEPTH", description: "This player likely won't see much meaningful opportunity on an NFL field without injuries or major changes ahead of them on the depth chart." },
        ],
      },
    },
  },
  TE: {
    intro:
      "Tight end is usually the most replaceable position on your dynasty team, but that doesn't mean there isn't still value waiting to be found. Rookie tight ends are actually one of the most likely positions to retain or gain value after their first season in the NFL, and there's also that ever-so-elusive chance that any tight end could turn into an elite asset for your team.",
    subscores: {
      Production: {
        text: "Similar to wide receivers, production is a very important differentiator between an average tight end and a difference maker at the next level. The best tight ends for your fantasy team were usually already putting up big numbers for their college football team.",
      },
      Volume: {
        text: "There are usually two main ways tight ends produce at a high level in fantasy football, and this tracks the first type: a target hog. While not as common as the next metric, some tight ends can command volume similar to a wide receiver, which is very telling for NFL success. Volume tracks how many targets per game a tight end saw in college.",
      },
      "Redzone Threat": {
        text: "This is the second type of tight end touched on in Volume: the touchdown merchant. Some tight ends don't command many targets, but can still produce for your team if a large amount of those targets come in the red zone, resulting in touchdowns and six points in your lineup. This metric tracks how many touchdowns per game a tight end scored in college.",
      },
      Athleticism: {
        text: "Another important metric when evaluating tight ends, this uses RAS (Relative Athletic Score) for each player and compares them to the average at the position. The best tight ends are usually better athletes, since being bigger, faster, and more explosive gives them a better chance to take advantage of the coverage usually given to tight ends.",
      },
      "Draft Capital": {
        text: "Tight end draft capital is similar to quarterback in that it matters a lot. First-round tight ends have a much higher chance of succeeding at the NFL level, and those odds fall off pretty quickly as you move later into the draft.",
      },
      Opportunity: {
        text: "This is a qualitative measure of a player's opportunity going into their NFL career.",
        classifications: [
          { label: "TE1", description: "This is a tight end who will be the starter on day one for their NFL team." },
          { label: "COM", description: "A committee tight end will most likely start in more of a backup role, but the guy in front of them is close enough to replacement level that there is a real opportunity to gain the starting job as the seasons go along." },
          { label: "DEPTH", description: "This player likely won't see much meaningful opportunity on an NFL field without injuries or major changes ahead of them on the depth chart." },
        ],
      },
    },
  },
};
