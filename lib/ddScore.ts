import type { Prospect, Tier } from "@/types/prospect";
import { finishWeight } from "@/lib/analytics";
import { formatAdjustment } from "@/lib/formatAdjustment";
import { getDisplayedPreDraftScore } from "@/lib/prospects";

export type LeagueFormat = "1QB" | "1QB_TEP" | "SUPERFLEX" | "SUPERFLEX_TEP";

export const LEAGUE_FORMATS: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];

const HIT_RATE_COEFFICIENT = 2.5;
const HIT_RATE_MAX_ADJUSTMENT = 8;

// Small position-specific shrinkage toward the pooled historical curve.
// QB is the noisiest position; RB is slightly over-dispersed.
// WR and TE retain their full position-specific calibration.
const POSITION_CALIBRATION_WEIGHT: Record<"QB" | "RB" | "WR" | "TE", number> = {
  QB: 0.55,
  RB: 0.85,
  WR: 1.00,
  TE: 1.00,
};
// QB_ADJUSTMENT / TE_ADJUSTMENT and the formatAdjustment() function
// that used them were moved to lib/formatAdjustment.ts, verbatim —
// same values, same logic, just relocated so lib/prospects.ts can
// reuse the exact same adjustment for devy Pre-Draft Scores without
// a circular import (see that file's own comment for the full
// explanation). Imported back in above.

export const DD_TIER_MIN: Record<Exclude<Tier, "Generational">, number> = {
  "Roster Clogger": 0,
  "Taxi Squad": 30,
  Bench: 42,
  "Upside Shot": 53,
  Flex: 63,
  Starter: 74,
  Elite: 84,
};
export const GENERATIONAL_MIN = 95;

export interface DDScoreResult {
  ddScore: number;
  hitProbability: number;
}

type LogisticModel = { intercept: number; slope: number };

/**
 * Fits a one-variable logistic regression with Newton-Raphson.
 * This is intentionally implemented here instead of hardcoding historical
 * hit-rate tables: every request recomputes the calibration from the current
 * Google Sheet's Hit/Miss outcomes and Positional Scores.
 */
function fitLogistic(points: { x: number; y: number }[]): LogisticModel {
  if (points.length === 0) return { intercept: 0, slope: 0 };

  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  let a = Math.log(Math.max(0.001, Math.min(0.999, meanY)) / Math.max(0.001, 1 - meanY));
  let b = 0;

  const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const scale = Math.max(1, Math.sqrt(
    points.reduce((s, p) => s + Math.pow(p.x - meanX, 2), 0) / points.length
  ));
  // Starting with a scaled slope makes convergence much more stable.
  b = 1 / scale;

  for (let iter = 0; iter < 60; iter++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;

    for (const p of points) {
      const z = Math.max(-35, Math.min(35, a + b * (p.x - meanX) / scale));
      const prob = 1 / (1 + Math.exp(-z));
      const w = Math.max(1e-8, prob * (1 - prob));
      const residual = p.y - prob;
      const x = (p.x - meanX) / scale;
      g0 += residual;
      g1 += residual * x;
      h00 += w;
      h01 += w * x;
      h11 += w * x * x;
    }

    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-10) break;

    const da = (g0 * h11 - g1 * h01) / det;
    const db = (g1 * h00 - g0 * h01) / det;
    a += da;
    b += db;

    if (Math.abs(da) + Math.abs(db) < 1e-7) break;
  }

  return {
    intercept: a - (b * meanX) / scale,
    slope: b / scale,
  };
}

function logistic(model: LogisticModel, x: number): number {
  const z = Math.max(-35, Math.min(35, model.intercept + model.slope * x));
  return 1 / (1 + Math.exp(-z));
}

function fitPositionModels(prospects: Prospect[]) {
  const positions = ["QB", "RB", "WR", "TE"] as const;
  const byPosition: Record<(typeof positions)[number], { x: number; y: number }[]> = {
    QB: [], RB: [], WR: [], TE: [],
  };
  const pooled: { x: number; y: number }[] = [];

  for (const p of prospects) {
    const score = p.grade?.overall;
    if (score === undefined || (p.hitMiss !== "HIT" && p.hitMiss !== "MISS")) continue;
    const point = { x: score, y: p.hitMiss === "HIT" ? 1 : 0 };
    if (p.position in byPosition) byPosition[p.position as keyof typeof byPosition].push(point);
    pooled.push(point);
  }

  const models = {
    QB: fitLogistic(byPosition.QB),
    RB: fitLogistic(byPosition.RB),
    WR: fitLogistic(byPosition.WR),
    TE: fitLogistic(byPosition.TE),
  };

  return { models, pooled: fitLogistic(pooled) };
}

export interface CalibrationCurvePoint {
  score: number;
  probability: number; // 0-100
}
export interface CalibrationBucket {
  scoreMin: number;
  scoreMax: number;
  hitRate: number | null; // 0-100, actual historical rate within this 10-point band
  count: number;
}
export interface PositionCalibration {
  position: "QB" | "RB" | "WR" | "TE";
  /** In Standard mode, the blend of the position-specific and pooled
   *  logistic models (see POSITION_CALIBRATION_WEIGHT) DD Score
   *  itself calibrates against — the real formula, not an
   *  approximation. In Weighted mode, the same fitting approach
   *  re-run against each player's outcome-quality score (0-130% via
   *  finishWeight, capped at 100% here) instead of a plain hit/miss —
   *  this line only exists for the chart; DD Score's real calibration
   *  always uses Standard, regardless of this display toggle. */
  curve: CalibrationCurvePoint[];
  /** The real historical outcomes the curve above is compared
   *  against, grouped into 10-point Positional Score bands. */
  buckets: CalibrationBucket[];
}

/**
 * Exposes the curve DD Score's calibration step uses internally (see
 * calculateFormatScores) so it can be charted, plus the real
 * per-bucket outcomes it's compared against. Standard mode is the
 * literal formula DD Score itself runs. Weighted mode re-fits the
 * same shape of curve against outcome-quality instead of a binary
 * hit/miss, purely for this chart's own display — it never feeds
 * back into DD Score, which is always Standard-calibrated.
 */
export function getCalibrationCurves(
  prospects: Prospect[],
  mode: "standard" | "weighted" = "standard"
): PositionCalibration[] {
  const positions = ["QB", "RB", "WR", "TE"] as const;

  // The 0-1 target each prospect contributes to the fit: a plain 1/0
  // hit-or-miss in Standard mode, or their outcome-quality score
  // (capped at 100%, same cap the Weighted Value Score uses) in
  // Weighted mode — falling back to plain 1/0 if a resolved prospect
  // has no recognized finish grade to weight by.
  const targetFor = (p: Prospect): number | undefined => {
    if (p.hitMiss !== "HIT" && p.hitMiss !== "MISS") return undefined;
    if (mode === "standard") return p.hitMiss === "HIT" ? 1 : 0;
    const weight = finishWeight(p.finish);
    return weight === undefined ? (p.hitMiss === "HIT" ? 1 : 0) : Math.min(weight, 100) / 100;
  };

  const byPosition: Record<(typeof positions)[number], { x: number; y: number }[]> = {
    QB: [], RB: [], WR: [], TE: [],
  };
  const pooled: { x: number; y: number }[] = [];
  for (const p of prospects) {
    const score = p.grade?.overall;
    const y = targetFor(p);
    if (score === undefined || y === undefined) continue;
    const point = { x: score, y };
    if (p.position in byPosition) byPosition[p.position as keyof typeof byPosition].push(point);
    pooled.push(point);
  }
  const models = {
    QB: fitLogistic(byPosition.QB),
    RB: fitLogistic(byPosition.RB),
    WR: fitLogistic(byPosition.WR),
    TE: fitLogistic(byPosition.TE),
  };
  const pooledModel = fitLogistic(pooled);

  return positions.map((position) => {
    const positionModel = models[position];
    const weight = POSITION_CALIBRATION_WEIGHT[position];

    const curve: CalibrationCurvePoint[] = [];
    for (let score = 0; score <= 100; score += 2) {
      const rawPositionProbability = logistic(positionModel, score);
      const pooledProbability = logistic(pooledModel, score);
      const probability = pooledProbability + weight * (rawPositionProbability - pooledProbability);
      curve.push({ score, probability: probability * 100 });
    }

    const buckets: CalibrationBucket[] = [];
    for (let b = 0; b < 100; b += 10) {
      const upper = b === 90 ? 101 : b + 10; // last bucket inclusive of 100
      const inBucket = prospects.filter(
        (p) =>
          p.position === position &&
          p.grade?.overall !== undefined &&
          p.grade.overall >= b &&
          p.grade.overall < upper &&
          (p.hitMiss === "HIT" || p.hitMiss === "MISS")
      );
      const ys = inBucket.map((p) => targetFor(p)).filter((y): y is number => y !== undefined);
      const avgY = ys.length > 0 ? ys.reduce((s, v) => s + v, 0) / ys.length : null;
      buckets.push({
        scoreMin: b,
        scoreMax: b + 10,
        hitRate: avgY !== null ? avgY * 100 : null,
        count: inBucket.length,
      });
    }

    return { position, curve, buckets };
  });
}

/**
 * The hit-rate correction is deliberately bounded. It can make a lower-scoring
 * player leapfrog a higher-scoring player when the historical positional hit
 * probability is meaningfully better, but it can never overwhelm the underlying
 * Positional Score by an unlimited amount.
 */
function hitRateAdjustment(
  score: number,
  positionProbability: number,
  pooledProbability: number
): number {
  const edge = positionProbability - pooledProbability;
  const magnitude = HIT_RATE_COEFFICIENT * Math.pow(Math.abs(edge) * 10, 1.35);
  const bounded = Math.min(HIT_RATE_MAX_ADJUSTMENT, magnitude) * Math.sign(edge);
  const extremeScoreShrink = 1 - 0.35 * Math.pow((score - 50) / 50, 2);
  return bounded * extremeScoreShrink;
}

function tierForScore(score: number): Tier {
  if (score >= GENERATIONAL_MIN) return "Generational";
  if (score >= DD_TIER_MIN.Elite) return "Elite";
  if (score >= DD_TIER_MIN.Starter) return "Starter";
  if (score >= DD_TIER_MIN.Flex) return "Flex";
  if (score >= DD_TIER_MIN["Upside Shot"]) return "Upside Shot";
  if (score >= DD_TIER_MIN.Bench) return "Bench";
  if (score >= DD_TIER_MIN["Taxi Squad"]) return "Taxi Squad";
  return "Roster Clogger";
}

function calculateFormatScores(
  prospects: Prospect[],
  format: LeagueFormat,
  models: ReturnType<typeof fitPositionModels>
) {
  const raw = new Map<string, number>();

  for (const p of prospects) {
    // Undrafted players intentionally have no DD Score. Their DD display
    // remains TBD and their only ranking metric is Pre-Draft Score within
    // the undrafted group.
    if (p.hasDraftData !== true) continue;
    const score = p.grade?.overall;
    if (score === undefined) continue;
    const positionModel = models.models[p.position as keyof typeof models.models];
    if (!positionModel) continue;

    const rawPositionProbability = logistic(positionModel, score);
    const pooledProbability = logistic(models.pooled, score);
    const weight = POSITION_CALIBRATION_WEIGHT[p.position as keyof typeof POSITION_CALIBRATION_WEIGHT] ?? 1;
    const positionProbability =
      pooledProbability + weight * (rawPositionProbability - pooledProbability);

    const adjustment = hitRateAdjustment(score, positionProbability, pooledProbability);
    const total = Math.max(0, Math.min(100, score + adjustment + formatAdjustment(p.position, format)));
    raw.set(p.id, total);

    // positionProbability doesn't actually vary by format (only the
    // final adjustment above does), so there's no need to recompute
    // and overwrite this on every one of the 4 format passes.
    if (format === "1QB") {
      p.ddHitProbability = positionProbability;
      p.ddHitRate1QB = positionProbability;
      p.ddHitRateSuperflex = positionProbability;
    }
  }

  // Normalize each format independently so the best current player is exactly 100.
  const max = Math.max(0, ...raw.values());
  const results = new Map<string, number>();
  for (const [id, value] of raw) {
    results.set(id, max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);
  }
  return results;
}

/**
 * Computes all four league formats from the live historical population.
 * Nothing is hardcoded to individual players. Any change to the Google Sheet's
 * Positional Scores or Hit/Miss outcomes changes the fitted probabilities and
 * therefore the DD Scores on the next data refresh.
 */
export function buildRanksWithinCollection(
  prospects: Prospect[],
  format: LeagueFormat
): Map<string, number> {
  const key = scoreKey(format);
  const drafted = prospects
    .filter((p) => p.hasDraftData === true && p[key] !== undefined)
    .sort((a, b) => ((b[key] as number) ?? -Infinity) - ((a[key] as number) ?? -Infinity));
  // Real, confirmed bug this fixes: this used to sort by the raw,
  // format-independent p.preDraftScore field directly, while the
  // drafted branch right above it already correctly used the
  // format-specific score key. That meant a devy class's ranking
  // order never actually changed with the format toggle, even after
  // getDisplayedPreDraftScore (lib/prospects.ts) was made
  // format-aware and the displayed numbers started changing —
  // the numbers moved but the order they appeared in didn't.
  const undrafted = prospects
    .filter((p) => p.hasDraftData !== true)
    .sort((a, b) => (getDisplayedPreDraftScore(b, format) ?? -Infinity) - (getDisplayedPreDraftScore(a, format) ?? -Infinity));
  const ranked = [...drafted, ...undrafted];
  return new Map(ranked.map((p, i) => [p.id, i + 1]));
}

export function applyDDScores(prospects: Prospect[]): void {
  const models = fitPositionModels(prospects);
  const scores = new Map<LeagueFormat, Map<string, number>>();
  for (const format of LEAGUE_FORMATS) {
    scores.set(format, calculateFormatScores(prospects, format, models));
  }

  for (const p of prospects) {
    p.ddScore1QB = scores.get("1QB")?.get(p.id);
    p.ddScore1QBTEP = scores.get("1QB_TEP")?.get(p.id);
    p.ddScoreSuperflex = scores.get("SUPERFLEX")?.get(p.id);
    p.ddScoreSuperflexTEP = scores.get("SUPERFLEX_TEP")?.get(p.id);

    p.ddScore = p.ddScore1QB;
    p.tier1QB = p.ddScore1QB === undefined ? undefined : tierForScore(p.ddScore1QB);
    p.tier1QBTEP = p.ddScore1QBTEP === undefined ? undefined : tierForScore(p.ddScore1QBTEP);
    p.tierSuperflex = p.ddScoreSuperflex === undefined ? undefined : tierForScore(p.ddScoreSuperflex);
    p.tierSuperflexTEP = p.ddScoreSuperflexTEP === undefined ? undefined : tierForScore(p.ddScoreSuperflexTEP);
    p.tier = p.tier1QB;
  }

  for (const format of LEAGUE_FORMATS) assignRanks(prospects, format);
}

function scoreKey(format: LeagueFormat): keyof Prospect {
  switch (format) {
    case "1QB": return "ddScore1QB";
    case "1QB_TEP": return "ddScore1QBTEP";
    case "SUPERFLEX": return "ddScoreSuperflex";
    case "SUPERFLEX_TEP": return "ddScoreSuperflexTEP";
  }
}

function assignRanks(prospects: Prospect[], format: LeagueFormat) {
  const key = scoreKey(format);
  const drafted = prospects
    .filter((p) => p.hasDraftData === true && p[key] !== undefined)
    .sort((a, b) => ((b[key] as number) ?? -Infinity) - ((a[key] as number) ?? -Infinity));
  const undrafted = prospects
    .filter((p) => p.hasDraftData !== true)
    .sort((a, b) => {
      const aScore = a.preDraftScore === undefined ? -Infinity : a.preDraftScore + formatAdjustment(a.position, format);
      const bScore = b.preDraftScore === undefined ? -Infinity : b.preDraftScore + formatAdjustment(b.position, format);
      return bScore - aScore;
    });

  const ranked = [...drafted, ...undrafted];
  ranked.forEach((p, i) => {
    const rank = i + 1;
    if (format === "1QB") p.ddRank1QB = rank;
    else if (format === "1QB_TEP") p.ddRank1QBTEP = rank;
    else if (format === "SUPERFLEX") p.ddRankSuperflex = rank;
    else p.ddRankSuperflexTEP = rank;
  });

  if (format === "1QB") {
    for (const p of prospects) p.rank = p.ddRank1QB;
  }
}

export function getDDScore(prospect: Prospect, format: LeagueFormat): number | undefined {
  return prospect[scoreKey(format)] as number | undefined;
}

export function getDDTier(prospect: Prospect, format: LeagueFormat): Tier | undefined {
  switch (format) {
    case "1QB": return prospect.tier1QB;
    case "1QB_TEP": return prospect.tier1QBTEP;
    case "SUPERFLEX": return prospect.tierSuperflex;
    case "SUPERFLEX_TEP": return prospect.tierSuperflexTEP;
  }
}

/** The prospect's own fixed overall rank for a format — independent of
 *  whatever subset of prospects is currently filtered/searched/paginated
 *  into view, so a search result never relabels a player's rank. */
export function getRankForFormat(prospect: Prospect, format: LeagueFormat): number | undefined {
  switch (format) {
    case "1QB": return prospect.ddRank1QB;
    case "1QB_TEP": return prospect.ddRank1QBTEP;
    case "SUPERFLEX": return prospect.ddRankSuperflex;
    case "SUPERFLEX_TEP": return prospect.ddRankSuperflexTEP;
  }
}

export function logDDScoreValidation(prospects: Prospect[]): void {
  console.error(`[dd-validation] calibration weights QB=${POSITION_CALIBRATION_WEIGHT.QB} RB=${POSITION_CALIBRATION_WEIGHT.RB} WR=${POSITION_CALIBRATION_WEIGHT.WR} TE=${POSITION_CALIBRATION_WEIGHT.TE}`);
  for (const format of LEAGUE_FORMATS) {
    const scored = prospects.filter((p) => getDDScore(p, format) !== undefined);
    const scores = scored.map((p) => getDDScore(p, format)!).sort((a, b) => a - b);
    const historical = scored.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
    console.error(
      `[dd-validation] ${format}: min=${scores[0]?.toFixed(2)} max=${scores[scores.length - 1]?.toFixed(2)} count>100=${scores.filter((s) => s > 100).length} historical=${historical.length}`
    );

    for (const tier of [
      "Roster Clogger", "Taxi Squad", "Bench", "Upside Shot",
      "Flex", "Starter", "Elite", "Generational",
    ] as Tier[]) {
      const inTier = scored.filter((p) => getDDTier(p, format) === tier);
      const outcomes = inTier.filter((p) => p.hitMiss === "HIT" || p.hitMiss === "MISS");
      const hitRate = outcomes.length
        ? (outcomes.filter((p) => p.hitMiss === "HIT").length / outcomes.length) * 100
        : null;
      const positions = Object.fromEntries(["QB", "RB", "WR", "TE"].map((pos) => {
        const g = outcomes.filter((p) => p.position === pos);
        return [pos, g.length ? `${((g.filter((p) => p.hitMiss === "HIT").length / g.length) * 100).toFixed(1)}% (${g.length})` : "n/a"];
      }));
      console.error(`[dd-validation] ${format} ${tier}: overall=${hitRate === null ? "n/a" : hitRate.toFixed(1)+"%"} ${JSON.stringify(positions)}`);
    }
  }
}
