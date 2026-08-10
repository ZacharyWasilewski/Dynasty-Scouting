import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getProspectById, getSheetData, getProspects } from "@/lib/googleSheets";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { DraftProjection } from "@/components/profile/DraftProjection";
import { PlayerComparison } from "@/components/profile/PlayerComparison";
import { computeDraftProjectionLabel } from "@/lib/draftProjection";
import { findSimilarProspects } from "@/lib/similarProspects";
import { getTierColor, getTierForScore } from "@/lib/tiers";

// Every player page is pre-built at deploy time, then quietly
// refreshed in the background every 60 seconds — matches the data
// layer's own cache window, so nobody ever waits on a live fetch.
export const revalidate = 60;

export async function generateStaticParams() {
  const prospects = await getProspects();
  return prospects.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const prospect = await getProspectById(params.id);
  return { title: prospect ? `${prospect.name} — Dynasty Database` : "Prospect — Dynasty Database" };
}

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
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

  return (
    <main>
      <ProfileHeader prospect={prospect} />

      {/* SCORES */}
      <section className="border-b border-border bg-surface py-14">
        <Container>
          <SectionHeading
            eyebrow="Grades"
            title="Score breakdown"
            description="The same grade, viewed through three other lenses — before the draft, without opportunity, and on raw college production alone."
          />
          <div className="mt-10 grid max-w-2xl grid-cols-3 items-start gap-x-8 gap-y-8">
            <ScoreRing
              label="Pre-Draft Score"
              value={prospect.preDraftScore}
              size={96}
              info="This score is calculated before the NFL Draft. It uses the same metrics, ignoring a players opportunity, and using mock draft data in place of a players draft position. Used to rank players before the NFL Draft takes place in April."
              color={
                prospect.preDraftScore !== undefined
                  ? getTierColor(getTierForScore(prospect.preDraftScore) ?? "Roster Clogger")
                  : undefined
              }
            />
            <ScoreRing
              label="Opportunity Independent Score"
              value={prospect.opportunityScore}
              size={96}
              info="The Prospect Score recalculated while ignoring a player's qualitative opportunity, this way only quantitative data is used."
              color={
                prospect.opportunityScore !== undefined
                  ? getTierColor(getTierForScore(prospect.opportunityScore) ?? "Roster Clogger")
                  : undefined
              }
            />
            <ScoreRing
              label="Raw Score"
              value={prospect.rawScore}
              size={96}
              info="How we judge a player based on raw college production. This score ignores mock draft data, opportunity, and real life draft position, to show just how good a player is based on their college metrics alone."
              color={
                prospect.rawScore !== undefined
                  ? getTierColor(getTierForScore(prospect.rawScore) ?? "Roster Clogger")
                  : undefined
              }
            />
          </div>

          {(prospect.finish || prospect.hitMiss) && (
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-8">
              <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                Career Outcome
              </span>
              {prospect.finish && <Badge tone="neutral">{prospect.finish}</Badge>}
              {prospect.hitMiss && (
                <span
                  className={`flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide ${
                    prospect.hitMiss === "HIT" ? "text-riser" : "text-faller"
                  }`}
                >
                  {prospect.hitMiss === "HIT" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {prospect.hitMiss}
                </span>
              )}
            </div>
          )}
        </Container>
      </section>

      {/* SIMILAR PROSPECTS */}
      {similarProspects.length > 0 && (
        <section className="border-b border-border bg-surface py-14">
          <Container>
            <SectionHeading
              eyebrow="Comparison Tool"
              title="Similar prospects"
              description="The 3 closest matches at this position, weighted by how much each score matters in the model. Tap one to compare head-to-head."
            />
            <div className="mt-10">
              <PlayerComparison current={prospect} similar={similarProspects} />
            </div>
          </Container>
        </section>
      )}

      {/* DRAFT PROJECTION */}
      <section className="bg-void py-14">
        <Container>
          <DraftProjection label={draftProjectionLabel} />
        </Container>
      </section>
    </main>
  );
}
