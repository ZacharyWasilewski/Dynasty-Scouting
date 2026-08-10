import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { PositionHeader } from "@/components/positions/PositionHeader";
import { PositionStats } from "@/components/positions/PositionStats";
import { PositionExplorer } from "@/components/positions/PositionExplorer";
import { TierHitRateChart } from "@/components/analytics/TierHitRateChart";
import { getPositionTheme, POSITION_THEMES } from "@/lib/positionThemes";
import { getProspects } from "@/lib/googleSheets";
import { computeHitRateByTier } from "@/lib/analytics";
import { ALL_TIERS } from "@/lib/tiers";

export function generateStaticParams() {
  return Object.keys(POSITION_THEMES).map((position) => ({ position }));
}

export function generateMetadata({ params }: { params: { position: string } }) {
  const theme = getPositionTheme(params.position);
  return { title: theme ? `${theme.label} — Dynasty Database` : "Position — Dynasty Database" };
}

export default async function PositionPage({ params }: { params: { position: string } }) {
  const theme = getPositionTheme(params.position);
  if (!theme) notFound();

  const allProspects = await getProspects();
  const prospects = allProspects.filter((p) => p.position === theme.code);
  const hitRateByTier = computeHitRateByTier(allProspects, ALL_TIERS, theme.code);

  return (
    <main>
      <PositionHeader theme={theme} count={prospects.length} />

      <section className="border-b border-border bg-void py-14">
        <Container>
          <PositionStats prospects={prospects} theme={theme} />
        </Container>
      </section>

      <section className="border-b border-border bg-surface py-14">
        <Container>
          <SectionHeading
            eyebrow="Hit Rate by Tier"
            title={`${theme.label} Real Career Outcomes`}
            description={`Share of ${theme.label.toLowerCase()} within each tier that produced for your fantasy football team.`}
          />
          <div className="mt-10 border border-border bg-void p-6 sm:p-8">
            <TierHitRateChart
              data={hitRateByTier}
              position={theme.code}
              emptyMessage={`No ${theme.label.toLowerCase()} have a resolved outcome yet.`}
            />
          </div>
        </Container>
      </section>

      <section className="bg-void py-14">
        <Container>
          <SectionHeading eyebrow="Rankings" title={`All ${theme.label.toLowerCase()}`} />
          <div className="mt-10">
            <PositionExplorer prospects={prospects} theme={theme} />
          </div>
        </Container>
      </section>
    </main>
  );
}
