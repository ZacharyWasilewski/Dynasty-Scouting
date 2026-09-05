import { notFound } from "next/navigation";
import Link from "next/link";
import { getProspectById, getSheetSnapshot } from "@/lib/googleSheets";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ModelScoresSection } from "@/components/profile/ModelScoresSection";
import { DraftProjection } from "@/components/profile/DraftProjection";
import { PlayerComparison } from "@/components/profile/PlayerComparison";
import { computeDraftProjection, type DraftProjectionResult } from "@/lib/draftProjection";
import { findSimilarProspects } from "@/lib/similarProspects";
import { computeHitRateByPositionAndTier } from "@/lib/analytics";
import { TIER_DEFINITIONS } from "@/lib/tiers";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { getWatchlistPopularity } from "@/lib/watchlistPopularity";
import type { Position, Prospect } from "@/types/prospect";

// Player profiles are always rendered dynamically from the canonical sheet
// snapshot. The league-format toggle remains client-side, but the underlying
// prospect, class pool, ranks, hit rates, comparisons, and projection are all
// produced from one live snapshot for each server render.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const prospect = await getProspectById(params.id);
  return { title: prospect ? `${prospect.name} — Dynasty Database` : "Prospect — Dynasty Database" };
}

// Class Rank / Position Rank — computed fresh here since none of the
// existing rank fields (prospect.rank, ddRank1QB, etc.) are actually
// scoped to a single class; every one of them ranks across the
// Real, confirmed bug: this used to always sort by ddScore1QB
// regardless of which format was actually selected, meaning Class
// Rank and Position Rank never updated when the format toggle
// changed — even though the DD Score and tier right next to them
// on the page did. Now accepts a format and sorts by that format's
// actual DD Score, computed for all 4 formats below so the page can
// show whichever one matches what's currently on screen.
function scoreForFormat(prospect: Prospect, format: LeagueFormat): number {
  if (prospect.hasDraftData === true) return getDDScore(prospect, format) ?? -Infinity;

  // Future/developmental classes do not have a Pre-Draft Score yet. The
  // profile intentionally uses Raw Score for those classes (currently 2028),
  // so class/position ranks must use that exact same format-adjusted score.
  const baseScore = prospect.draftClass === "2028" ? prospect.rawScore : prospect.preDraftScore;
  return applyFormatAdjustment(baseScore, prospect.position, format) ?? -Infinity;
}

function rankWithinPool(target: Prospect, pool: Prospect[], format: LeagueFormat): number | undefined {
  const ranked = [...pool].sort((a, b) => {
    const aScore = scoreForFormat(a, format);
    const bScore = scoreForFormat(b, format);
    return bScore - aScore || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  const idx = ranked.findIndex((p) => p.id === target.id);
  return idx === -1 ? undefined : idx + 1;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  // Read exactly one canonical snapshot for this entire profile render. The
  // previous Promise.all() performed two independently-versioned reads, which
  // made a refresh boundary capable of mixing a player object from snapshot N
  // with class pools from snapshot N+1. Every score, rank, tier, comparison,
  // and draft projection below now originates from this one snapshot.
  const snapshot = await getSheetSnapshot();
  const sheetData = snapshot.data;
  const allProspects = sheetData.prospects;
  const foundProspect = allProspects.find((p) => p.id === params.id);
  if (!foundProspect) notFound();
  // Explicit local narrowing keeps this file type-safe even in tooling that
  // does not load Next's `notFound(): never` declaration.
  const currentProspect: Prospect = foundProspect as Prospect;
  // Awaited like everything else on this page, but this is cheap in
  // practice: a cached, precomputed lookup (see
  // lib/watchlistPopularity.ts) rather than a live per-request
  // aggregation query, so it doesn't meaningfully add to render time.
  // A cold cache or DB hiccup already resolves to null internally,
  // which correctly just omits the stat rather than breaking the page.
  const watchlistPopularity = await getWatchlistPopularity(currentProspect.id);
  const weights = currentProspect.position in sheetData.subScoreWeights
    ? sheetData.subScoreWeights[currentProspect.position as "QB" | "RB" | "WR" | "TE"]
    : {};

  const similarProspects = findSimilarProspects(currentProspect, allProspects, weights, 5);

  const classPool = currentProspect.draftClass ? allProspects.filter((p) => p.draftClass === currentProspect.draftClass) : [];
  const positionPool = classPool.filter((p) => p.position === currentProspect.position);
  const RANK_FORMATS: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];
  const draftProjectionByFormat = {} as Record<LeagueFormat, DraftProjectionResult>;
  for (const fmt of RANK_FORMATS) {
    draftProjectionByFormat[fmt] = computeDraftProjection(currentProspect, allProspects, fmt);
  }
  const classRankByFormat: Record<string, { rank: number | undefined; total: number } | undefined> = {};
  const positionRankByFormat: Record<string, { rank: number | undefined; total: number } | undefined> = {};
  for (const fmt of RANK_FORMATS) {
    classRankByFormat[fmt] =
      classPool.length > 0 ? { rank: rankWithinPool(currentProspect, classPool, fmt), total: classPool.length } : undefined;
    positionRankByFormat[fmt] =
      positionPool.length > 0
        ? { rank: rankWithinPool(currentProspect, positionPool, fmt), total: positionPool.length }
        : undefined;
  }

  // Hit rate at this tier — every tier for this player's position,
  // for all 4 league formats, so the Core Evaluation area can pick
  // the exact entry that matches whatever's actually on screen (the
  // DD Score tier, which changes with the 1QB/Superflex/TEP format
  // toggle) rather than a value that could silently mismatch what
  // the page is showing. Uses computeHitRateByPositionAndTier
  // specifically — the tier-determination logic here has to be the
  // exact same one the rest of the page uses to display a tier
  // (tierForFormat's precomputed fields), not a separately-computed
  // "positional tier" system with different thresholds under the
  // same tier names. That mismatch was a real, shipped bug: a
  // player's hit-rate fraction and percentage could mathematically
  // contradict each other because they weren't describing the same
  // group of prospects.
  const tierNames = TIER_DEFINITIONS.map((t) => t.name);
  const hitRatesByFormatAndTier: Record<string, ReturnType<typeof computeHitRateByPositionAndTier>> = {
    "1QB": computeHitRateByPositionAndTier(allProspects, currentProspect.position as Position, { qbFormat: "1QB", tepFormat: "STANDARD" }, tierNames),
    "1QB_TEP": computeHitRateByPositionAndTier(allProspects, currentProspect.position as Position, { qbFormat: "1QB", tepFormat: "TEP" }, tierNames),
    SUPERFLEX: computeHitRateByPositionAndTier(allProspects, currentProspect.position as Position, { qbFormat: "SF", tepFormat: "STANDARD" }, tierNames),
    SUPERFLEX_TEP: computeHitRateByPositionAndTier(allProspects, currentProspect.position as Position, { qbFormat: "SF", tepFormat: "TEP" }, tierNames),
  };

  return (
    <main>
      <ProfileHeader
        prospect={currentProspect}
        classRankByFormat={classRankByFormat}
        positionRankByFormat={positionRankByFormat}
        hitRatesByFormatAndTier={hitRatesByFormatAndTier}
        watchlistPopularity={watchlistPopularity}
      />

      {/* SCORES — now format-aware; see ModelScoresSection's own
          comment for why this had to become a client component. */}
      <ModelScoresSection prospect={currentProspect} classPool={classPool} />

      {/* RESEARCH CONTEXT — keep related decision-support modules in the
          same vertical neighborhood so the profile stays dense without
          turning every section into a giant standalone panel. */}
      <section className="border-b border-border bg-void py-8 lg:py-9">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-start">
            {similarProspects.length > 0 ? (
              <div id="similar-prospects" className="min-w-0 scroll-mt-24">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <SectionHeading
                    eyebrow="Comparison Tool"
                    title="Similar prospects"
                    description="The closest model matches at this position, weighted by how much each score matters. Desktop shows five; smaller displays keep the three strongest matches."
                  />
                  <Link
                    href={`/compare?a=${currentProspect.id}`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-widest2 text-accent hover:underline"
                  >
                    Compare →
                  </Link>
                </div>
                <div className="mt-5">
                  <PlayerComparison current={currentProspect} similar={similarProspects} allProspects={allProspects} weights={weights} />
                </div>
              </div>
            ) : <div />}

            <div id="draft-projection" className="min-w-0 scroll-mt-24">
              <DraftProjection projectionsByFormat={draftProjectionByFormat} />
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
