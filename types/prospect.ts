/**
 * Domain types for Dynasty Database.
 *
 * NOTE: This file defines shapes only. No prospect data is populated
 * here — real data will be wired up in a later phase once a source
 * (manual entry, CMS, or API) is decided on.
 */

export type Position =
  | "QB"
  | "RB"
  | "FB"
  | "WR"
  | "TE"
  | "OT"
  | "IOL"
  | "EDGE"
  | "IDL"
  | "LB"
  | "CB"
  | "S"
  | "K"
  | "P"
  | "LS";

export type DraftRound = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "UDFA";

// Real historical data spans many draft years (the sheet includes
// backtested classes back to 2010), so this is a plain string rather
// than a fixed union.
export type DraftClassYear = string;

export type Tier =
  | "Generational"
  | "Elite"
  | "Starter"
  | "Flex"
  | "Upside Shot"
  | "Bench"
  | "Taxi Squad"
  | "Roster Clogger";

export interface Measurables {
  heightInches: number;
  weightLbs: number;
  fortyYardDash?: number;
  vertical?: number;
  broadJump?: number;
  threeCone?: number;
  shuttle?: number;
  armLength?: number;
  handSize?: number;
}

export interface GradeBreakdown {
  film: number; // 0–100
  production: number; // 0–100
  measurables: number; // 0–100
  overall: number; // 0–100, weighted composite
}

export interface RadarAttribute {
  label: string;
  value: number; // 0–100
}

export interface SubScore {
  label: string;
  value?: number; // 0-100, rounded — used for percentile-based scores
  text?: string; // for scores that are a text label, not a percentile (e.g. "QB1")
  /** Force the Elite tier color regardless of the computed percentile
   *  (e.g. an elite breakout-age "18.5+" that should always read as
   *  a max score, but shouldn't visually look identical to a real
   *  Generational-tier percentile). */
  isElite?: boolean;
}

export interface HistoricalComparison {
  name: string;
  note?: string;
}

export interface SeasonStat {
  season: string; // e.g. "2025"
  team: string;
  stats: Record<string, string | number>;
}

export interface DraftProjection {
  round?: DraftRound;
  range?: string; // e.g. "Late 1st – Early 2nd"
  summary?: string;
}

export interface Prospect {
  id: string;
  rank?: number; // overall big board position
  name: string;
  school?: string;
  position: Position;
  classYear?: "FR" | "SO" | "JR" | "SR" | "GR";
  age?: number;
  draftClass?: DraftClassYear;
  tier?: Tier;
  measurables?: Measurables;
  grade?: GradeBreakdown; // grade.overall doubles as "Prospect Score"
  rawScore?: number; // sheet's pre-weighting "Raw Score"
  preDraftScore?: number; // 0–100
  opportunityScore?: number; // 0–100, sheet's "O.I.S"
  finish?: string; // real career outcome grade, e.g. "Stud", "BUST"
  hitMiss?: "HIT" | "MISS"; // real outcome vs. projection
  radarAttributes?: RadarAttribute[];
  strengths?: string[];
  weaknesses?: string[];
  historicalComparisons?: HistoricalComparison[];
  careerStats?: SeasonStat[];
  /**
   * The 4 position-specific percentile sub-scores (0-100), computed
   * live from the sheet's per-position/year measurable tabs. Always
   * exactly 4, in display order, e.g. for QB:
   * [Production, Rushing, Draft Capital, Opportunity].
   */
  subScores?: SubScore[];
  draftProjection?: DraftProjection;
  projectedRound?: DraftRound;
  summary?: string;
  photoUrl?: string;
  updatedAt?: string; // ISO date
}

export interface TeamNeed {
  teamAbbr: string;
  position: Position;
  priority: "critical" | "high" | "medium" | "low";
}

export interface MockPick {
  overall: number;
  round: DraftRound;
  teamAbbr: string;
  prospectId?: string;
}

/** One row of the sheet's real Tier summary table. */
export interface TierSummaryRow {
  tier: string;
  prospects: number;
  eligibleProspects: number;
  hitRate: number | null; // percentage, 0–100
}

/** One row of the sheet's real Class Year historical trend table. */
export interface ClassYearTrend {
  classYear: string;
  hitRate: number | null; // percentage, 0–100
  round1AV: number | null;
  round2AV: number | null;
  round3AV: number | null;
  round4AV: number | null;
  round1HitRate: number | null; // percentage, 0–100
  round2HitRate: number | null;
  round3HitRate: number | null;
  round4HitRate: number | null;
}
