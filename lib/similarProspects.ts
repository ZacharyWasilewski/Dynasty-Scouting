import type { Prospect } from "@/types/prospect";

/**
 * A prospect is "resolved" once they have a Draft Capital score (a
 * real ADP), and compares using their Prospect Score. Before that,
 * they're "pre-draft" (a Mock score stands in for Draft Capital) and
 * compare using their Pre-Draft Score instead. Because this is
 * judged purely by whether a prospect has real draft capital yet —
 * not by year — it naturally updates itself once a class actually
 * gets drafted.
 */
export function getOverallScore(p: Prospect): number | undefined {
  // Comparison uses DD Score for drafted/resolved players. Undrafted
  // players have no DD Score (displayed as TBD) and compare using
  // Pre-Draft Score instead.
  if (isResolved(p)) return p.ddScore;
  if (p.subScores?.some((s) => s.label === "Mock")) return p.preDraftScore;
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
  count = 3
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

  const prospectOverall = prospectResolved ? prospect.ddScore : prospect.preDraftScore;

  const withDistance = candidates.map((p) => {
    const crossRegime = prospectResolved !== isResolved(p);

    let weightedDistanceSq = 0;
    let totalWeight = 0;
    for (const s of prospect.subScores!) {
      if (crossRegime && REGIME_SPECIFIC_LABELS.has(s.label)) continue; // not a shared metric
      if (s.value === undefined) continue; // text-based score (e.g. Opportunity) — not comparable numerically
      const other = p.subScores!.find((o) => o.label === s.label)?.value;
      if (other === undefined) continue;
      const w = weights[s.label] ?? 1;
      const diff = s.value - other;
      weightedDistanceSq += w * diff * diff;
      totalWeight += w;
    }

    // Overall grade matters too, not just the underlying skills —
    // weighted equal to everything else combined, so a similar skill
    // profile with a wildly different grade doesn't rank as a close
    // match. A pre-draft prospect always compares on Pre-Draft Score
    // (using the candidate's Pre-Draft Score too, even if that
    // candidate is now resolved), to keep it apples-to-apples.
    const otherOverall = prospectResolved ? getOverallScore(p) : p.preDraftScore;
    if (prospectOverall !== undefined && otherOverall !== undefined && totalWeight > 0) {
      const diff = prospectOverall - otherOverall;
      weightedDistanceSq += totalWeight * diff * diff;
      totalWeight += totalWeight;
    }

    // No shared numeric dimensions at all — treat as least similar,
    // not most similar (an empty sum would otherwise look identical).
    const distance = totalWeight > 0 ? Math.sqrt(weightedDistanceSq / totalWeight) : Infinity;
    return { prospect: p, distance };
  });

  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, count).map((d) => d.prospect);
}
