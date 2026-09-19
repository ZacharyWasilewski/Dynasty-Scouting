import type { Prospect } from "@/types/prospect";

/**
 * Trims a prospect down to only the fields the homepage actually reads.
 *
 * Why this exists: the homepage handed the complete prospect array —
 * every class since 2015, with ~98 possible fields each including the
 * full subScores array — to five separate client components. All of it
 * had to be serialized into the HTML payload, and production traffic
 * showed the cost plainly: every other route answered in 36-484ms while
 * the homepage sat at 900-1500ms on every single request.
 *
 * Nothing here changes a component's type. Only `id`, `name` and
 * `position` are required on Prospect, so a slimmed object is still a
 * valid Prospect and every consumer type-checks unchanged — the fields
 * being dropped are ones the homepage never touches.
 *
 * The audited field set below covers direct property reads in Hero,
 * NextClassSpotlight, ModelTrackRecord, ProductShowcase and
 * ExploreDatabase, plus everything their helpers need:
 *   - getDisplayedPreDraftScore -> grade, hasDraftData, position,
 *     positionalScore, preDraftScore
 *   - overallStats -> grade
 *   - computeCombinedHitRate -> hitMiss, position, and the
 *     format-specific score/tier fields
 *
 * Deliberately NOT included: subScores (the single largest field, an
 * array of objects per player), and the per-metric detail behind it.
 * Only the full comparison view needs those, and it now loads them on
 * demand — see TryComparison.
 */
export function toHomeProspect(p: Prospect): Prospect {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    school: p.school,
    schoolLogoUrl: p.schoolLogoUrl,
    photoUrl: p.photoUrl,
    draftClass: p.draftClass,
    hasDraftData: p.hasDraftData,
    hitMiss: p.hitMiss,
    grade: p.grade,
    positionalScore: p.positionalScore,
    preDraftScore: p.preDraftScore,
    ddScore: p.ddScore,
    ddScore1QB: p.ddScore1QB,
    ddScore1QBTEP: p.ddScore1QBTEP,
    ddScoreSuperflex: p.ddScoreSuperflex,
    ddScoreSuperflexTEP: p.ddScoreSuperflexTEP,
    tier: p.tier,
    tier1QB: p.tier1QB,
    tier1QBTEP: p.tier1QBTEP,
    tierSuperflex: p.tierSuperflex,
    tierSuperflexTEP: p.tierSuperflexTEP,
  };
}

export function toHomeProspects(prospects: Prospect[]): Prospect[] {
  return prospects.map(toHomeProspect);
}
