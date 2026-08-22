import { notFound } from "next/navigation";
import Link from "next/link";
import { getProspectById, getSheetData, getProspects } from "@/lib/googleSheets";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { DraftProjection } from "@/components/profile/DraftProjection";
import { PlayerComparison } from "@/components/profile/PlayerComparison";
import { computeDraftProjectionLabel } from "@/lib/draftProjection";
import { findSimilarProspects } from "@/lib/similarProspects";
import { computeHitRateByPositionAndTier } from "@/lib/analytics";
import { getTierColor, getPositionalTierForScore, TIER_DEFINITIONS } from "@/lib/tiers";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import type { Position, Prospect } from "@/types/prospect";

// Every player page is pre-built at deploy time, then quietly
// refreshed in the background every 5 minutes — matches the data
// layer's own cache window, so nobody ever waits on a live fetch.
// IMPORTANT: this page must never read `searchParams` directly in
// the server component — doing so forces Next.js to render the
// whole route dynamically on every request, bypassing this static
// generation entirely. The league-format toggle is handled
// client-side in ProfileHeader instead, using data already present
// on every prospect (ddScore1QB / ddScoreSuperflex / etc.).
export const revalidate = 60;

export async function generateStaticParams() {
  const prospects = await getProspects();
  return prospects.map((p) => ({ id: p.id }));
}

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
function rankWithinPool(target: Prospect, pool: Prospect[], format: LeagueFormat): number | undefined {
  const ranked = [...pool].sort((a, b) => {
    const aDrafted = a.hasDraftData === true;
    const bDrafted = b.hasDraftData === true;
    if (aDrafted !== bDrafted) return aDrafted ? -1 : 1;
    if (aDrafted) return (getDDScore(b, format) ?? -Infinity) - (getDDScore(a, format) ?? -Infinity);
    return (b.preDraftScore ?? -Infinity) - (a.preDraftScore ?? -Infinity);
  });
  const idx = ranked.findIndex((p) => p.id === target.id);
  return idx === -1 ? undefined : idx + 1;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const [prospect, sheetData] = await Promise.all([
    getProspectById(params.id),
    getSheetData(),
  ]);
  if (!prospect) notFound();

  const allProspects = sheetData.prospects;
  const weights = prospect.position in sheetData.subScoreWeights
    ? sheetData.subScoreWeights[prospect.position as "QB" | "RB" | "WR" | "TE"]
    : {};

  const draftProjectionLabel = computeDraftProjectionLabel(prospect, allProspects);
  const similarProspects = findSimilarProspects(prospect, allProspects, weights);

  const classPool = prospect.draftClass ? allProspects.filter((p) => p.draftClass === prospect.draftClass) : [];
  const positionPool = classPool.filter((p) => p.position === prospect.position);
  const RANK_FORMATS: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];
  const classRankByFormat: Record<string, { rank: number | undefined; total: number } | undefined> = {};
  const positionRankByFormat: Record<string, { rank: number | undefined; total: number } | undefined> = {};
  for (const fmt of RANK_FORMATS) {
    classRankByFormat[fmt] =
      classPool.length > 0 ? { rank: rankWithinPool(prospect, classPool, fmt), total: classPool.length } : undefined;
    positionRankByFormat[fmt] =
      positionPool.length > 0
        ? { rank: rankWithinPool(prospect, positionPool, fmt), total: positionPool.length }
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
    "1QB": computeHitRateByPositionAndTier(allProspects, prospect.position as Position, { qbFormat: "1QB", tepFormat: "STANDARD" }, tierNames),
    "1QB_TEP": computeHitRateByPositionAndTier(allProspects, prospect.position as Position, { qbFormat: "1QB", tepFormat: "TEP" }, tierNames),
    SUPERFLEX: computeHitRateByPositionAndTier(allProspects, prospect.position as Position, { qbFormat: "SF", tepFormat: "STANDARD" }, tierNames),
    SUPERFLEX_TEP: computeHitRateByPositionAndTier(allProspects, prospect.position as Position, { qbFormat: "SF", tepFormat: "TEP" }, tierNames),
  };

  return (
    <main>
      <ProfileHeader
        prospect={prospect}
        classRankByFormat={classRankByFormat}
        positionRankByFormat={positionRankByFormat}
        hitRatesByFormatAndTier={hitRatesByFormatAndTier}
      />

      {/* SCORES — the Positional Score gets real visual priority
          (a genuinely larger ring, not just first-in-a-row) since
          it's the one that actually feeds Dynasty Database Score;
          the other three are supporting context, not equal peers,
          and now look like it. */}
      <section className="border-b border-border bg-surface py-10">
        <Container>
          <SectionHeading
            eyebrow="Model Scores"
            title="The four underlying model scores"
            description="The analytical components behind Dynasty Database Score — the same grade, viewed through four lenses: the core positional model, before the draft, without opportunity, and on raw college production alone."
          />
          <div className="mt-8 flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
            <ScoreRing
              label="Positional Score"
              value={prospect.grade?.overall}
              size={168}
              info="Calculated by weighting the scores seen under each player's profile, as well as a few smaller tweaks from other metrics on the backend. This is a player's core positional grade, and the primary input to Dynasty Database Score."
              color={prospect.grade?.overall !== undefined
                ? getTierColor(getPositionalTierForScore(prospect.grade.overall) ?? "Roster Clogger")
                : undefined}
            />
            {/* Single column on mobile — three 76px rings side by
                side with long, wrapping labels ("Opportunity
                Independent Score") in only 12px of gap looked
                genuinely crowded on a narrow screen. Row layout
                returns at sm: where there's enough width for it. */}
            <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-3 sm:gap-8">
              <ScoreRing
                label="Pre-Draft Score"
                value={prospect.preDraftScore}
                size={76}
                info="This score is calculated before the NFL Draft. It uses the same metrics, ignoring a player's opportunity, and using mock draft data in place of a player's draft position. Used to rank players before the NFL Draft takes place in April."
                color={
                  prospect.preDraftScore !== undefined
                    ? getTierColor(getPositionalTierForScore(prospect.preDraftScore) ?? "Roster Clogger")
                    : undefined
                }
              />
              <ScoreRing
                label="Opportunity Independent Score"
                value={prospect.opportunityScore}
                size={76}
                info="The Positional Score recalculated while ignoring a player's qualitative opportunity, this way only quantitative data is used."
                color={
                  prospect.opportunityScore !== undefined
                    ? getTierColor(getPositionalTierForScore(prospect.opportunityScore) ?? "Roster Clogger")
                    : undefined
                }
              />
              <ScoreRing
                label="Raw Score"
                value={prospect.rawScore}
                size={76}
                info="How we judge a player based on raw college production. This score ignores mock draft data, opportunity, and real life draft position, to show just how good a player is based on their college metrics alone."
                color={
                  prospect.rawScore !== undefined
                    ? getTierColor(getPositionalTierForScore(prospect.rawScore) ?? "Roster Clogger")
                    : undefined
                }
              />
            </div>
          </div>
        </Container>
      </section>

      {/* SIMILAR PROSPECTS */}
      {similarProspects.length > 0 && (
        <section className="border-b border-border bg-void py-10">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow="Comparison Tool"
                title="Similar prospects"
                description="The 3 closest matches at this position, weighted by how much each score matters in the model. Tap one to compare head-to-head."
              />
              <Link
                href={`/compare?a=${prospect.id}`}
                className="shrink-0 font-mono text-xs uppercase tracking-widest2 text-accent hover:underline"
              >
                Compare against anyone else →
              </Link>
            </div>
            <div className="mt-8">
              <PlayerComparison current={prospect} similar={similarProspects} />
            </div>
          </Container>
        </section>
      )}

      {/* DRAFT PROJECTION */}
      <section className="bg-surface py-10">
        <Container>
          <DraftProjection label={draftProjectionLabel} />
        </Container>
      </section>
    </main>
  );
}
