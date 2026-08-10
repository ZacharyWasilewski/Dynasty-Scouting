import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { BarChart } from "@/components/analytics/BarChart";
import { getSheetData } from "@/lib/googleSheets";

// Every class year page is pre-built at deploy time, then quietly
// refreshed in the background every 60 seconds — matches the data
// layer's own cache window, so nobody ever waits on a live fetch.
export const revalidate = 60;

export async function generateStaticParams() {
  const { prospects } = await getSheetData();
  const years = new Set(prospects.map((p) => p.draftClass).filter((y): y is string => Boolean(y)));
  return [...years].map((year) => ({ year }));
}

export async function generateMetadata({ params }: { params: { year: string } }) {
  return { title: `${params.year} Draft Class — Dynasty Database` };
}

export default async function ClassYearPage({ params }: { params: { year: string } }) {
  if (!/^\d{4}$/.test(params.year)) notFound();

  const { prospects: allProspects, classTrend } = await getSheetData();
  const prospects = allProspects.filter((p) => p.draftClass === params.year);
  const trend = classTrend.find((c) => c.classYear === params.year);

  const roundData = trend
    ? [
        { label: "Round 1", value: trend.round1AV ?? 0 },
        { label: "Round 2", value: trend.round2AV ?? 0 },
        { label: "Round 3", value: trend.round3AV ?? 0 },
        { label: "Round 4", value: trend.round4AV ?? 0 },
      ]
    : [];

  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Layers className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                Draft Class
              </span>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                {params.year}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Every graded prospect from the {params.year} class, ranked
                and sortable by position, school, and tier.
              </p>
            </div>
          </div>
          <Badge tone="accent" className="shrink-0">
            {prospects.length} prospects
          </Badge>
        </Container>
      </section>

      {/* ROUND BREAKDOWN */}
      <section className="border-b border-border bg-void py-10">
        <Container>
          <div className="border border-border bg-surface p-6 sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink">
              Average Value by Round
            </h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-tertiary">
              Real NFL career production by round, for the {params.year} class.
            </p>
            <div className="mt-6">
              <BarChart
                data={roundData}
                emptyMessage="No round data available for this class yet."
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <RankingsTable prospects={prospects} />
        </Container>
      </section>
    </main>
  );
}
