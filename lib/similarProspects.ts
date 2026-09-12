import type { Prospect } from "@/types/prospect";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";

/**
 * A prospect is "resolved" once they have a Draft Capital score (a
 * real ADP), and compares using their Prospect Score. Before that,
 * they're "pre-draft" (a Mock score stands in for Draft Capital) and
 * compare using their Pre-Draft Score instead. Because this is
 * judged purely by whether a prospect has real draft capital yet —
 * not by year — it naturally updates itself once a class actually
 * gets drafted.
 */
export function getOverallScore(p: Prospect, format: LeagueFormat = "SUPERFLEX"): number | undefined {
  // Comparison uses DD Score for drafted/resolved players. Undrafted
  // players have no DD Score (displayed as TBD) and compare using
  // Pre-Draft Score instead.
  if (isResolved(p)) return getDDScore(p, format);
  if (p.subScores?.some((s) => s.label === "Mock")) return applyFormatAdjustment(p.preDraftScore, p.position, format);
  return undefined;
}

export function isResolved(p: Prospect): boolean | undefined {
  if (!p.subScores) return undefined;
  if (p.subScores.some((s) => s.label === "Draft Capital")) return true;
  if (p.subScores.some((s) => s.label === "Mock")) return false;
  return undefined;
}

/** Sub-scores that only exist in one regime — not shared between a
 *  resolved prospect and a still-projecting one, so they're excluded
 *  whenever the comparison crosses regimes. */
const REGIME_SPECIFIC_LABELS = new Set(["Draft Capital", "Opportunity", "Mock"]);

/** How much of the final distance the overall grade accounts for, with
 *  the rest coming from the weighted metric profile. Fixed rather than
 *  derived per candidate so every comparison is on one scale. */
const OVERALL_SHARE = 0.5;

/** Minimum shared metrics before a candidate is considered comparable
 *  at all (or all of them, when a prospect has fewer than this). */
const MIN_SHARED_METRICS = 2;

/**
 * The 3 same-position prospects whose sub-scores most closely
 * resemble this prospect's, by weighted straight-line distance
 * across whichever numeric scores both players actually have
 * (matched by label, since one player might be missing a score the
 * other has).
 *
 * This is intentionally one-directional: a still-projecting prospect
 * (no real ADP yet) can be compared against prospects from any past
 * class, using their Pre-Draft Score and only the metrics that carry
 * over to both regimes — but a resolved prospect is never compared
 * against a still-projecting one, so a proven player's comparisons
 * never get diluted by unproven future prospects.
 *
 * `weights` (from the sheet's "Weight Scales" tab) lets whichever
 * metrics the model itself weighs heavily dominate the match too —
 * a label missing from `weights` just falls back to a weight of 1.
 */
export function findSimilarProspects(
  prospect: Prospect,
  allProspects: Prospect[],
  weights: Record<string, number> = {},
  count = 3,
  format: LeagueFormat = "SUPERFLEX"
): Prospect[] {
  if (!prospect.subScores || prospect.subScores.length === 0) return [];
  const prospectResolved = isResolved(prospect);
  if (prospectResolved === undefined) return [];

  // Resolved prospects only ever compare against other resolved
  // prospects. Pre-draft prospects can compare against anyone (any
  // past class, resolved or not), since every past prospect still
  // has a Pre-Draft Score to fall back on for a fair comparison.
  const candidates = allProspects.filter((p) => {
    if (p.id === prospect.id || p.position !== prospect.position) return false;
    if (!p.subScores || p.subScores.length === 0) return false;
    if (prospectResolved) return isResolved(p) === true;
    return p.preDraftScore !== undefined;
  });

  const prospectOverall = getOverallScore(prospect, format);
  // How many of this prospect's own metrics could ever be matched, so
  // the minimum-overlap rule adapts to a sparse profile instead of
  // excluding everyone.
  const comparableCount = prospect.subScores!.filter((s) => s.value !== undefined).length;

  const withDistance = candidates.map((p) => {
    const crossRegime = prospectResolved !== isResolved(p);

    let weightedDistanceSq = 0;
    let totalWeight = 0;
    let sharedCount = 0;
    for (const s of prospect.subScores!) {
      if (crossRegime && REGIME_SPECIFIC_LABELS.has(s.label)) continue; // not a shared metric
      if (s.value === undefined) continue; // text-based score (e.g. Opportunity) — not comparable numerically
      const other = p.subScores!.find((o) => o.label === s.label)?.value;
      if (other === undefined) continue;
      const w = weights[s.label] ?? 1;
      const diff = s.value - other;
      weightedDistanceSq += w * diff * diff;
      totalWeight += w;
      sharedCount++;
    }

    // Thin overlap produces false matches. A candidate sharing a
    // single metric that happens to line up would otherwise score as
    // a perfect match and outrank someone who genuinely resembles
    // this prospect across their whole profile, because the average
    // was taken over whatever few dimensions existed.
    if (sharedCount < Math.min(MIN_SHARED_METRICS, comparableCount)) {
      return { prospect: p, distance: Infinity };
    }

    // Mean weighted squared difference across the shared metrics —
    // scale-stable, so candidates sharing different numbers of
    // metrics stay comparable to each other.
    const metricMeanSq = totalWeight > 0 ? weightedDistanceSq / totalWeight : undefined;

    // Overall grade matters too, not just the underlying skills, so a
    // similar profile with a wildly different grade isn't a close
    // match. It gets a FIXED share of the final distance rather than
    // the previous "weight it equal to the sum of everything else":
    // that sum varied per candidate, so the grade silently counted
    // for more against some candidates than others and the resulting
    // distances weren't on a common scale.
    const otherOverall = getOverallScore(p, format);
    const overallDiff =
      prospectOverall !== undefined && otherOverall !== undefined
        ? prospectOverall - otherOverall
        : undefined;

    let distance: number;
    if (metricMeanSq !== undefined && overallDiff !== undefined) {
      distance = Math.sqrt(
        (1 - OVERALL_SHARE) * metricMeanSq + OVERALL_SHARE * overallDiff * overallDiff
      );
    } else if (metricMeanSq !== undefined) {
      distance = Math.sqrt(metricMeanSq);
    } else {
      // No shared numeric dimensions at all — least similar, not most
      // similar (an empty sum would otherwise look identical).
      distance = Infinity;
    }
    return { prospect: p, distance };
  });

  // Drop non-comparable candidates outright rather than letting them
  // fill the list when few real matches exist — showing three
  // "comparisons" built on no shared data is worse than showing one
  // real one.
  return withDistance
    .filter((d) => Number.isFinite(d.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((d) => d.prospect);
}
