import { BarChart3 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { DashboardStats } from "@/components/analytics/DashboardStats";
import { DashboardCard } from "@/components/analytics/DashboardCard";
import { RoundBreakdownChart } from "@/components/analytics/RoundBreakdownChart";
import { TierHitRates } from "@/components/analytics/TierHitRates";
import { getSheetData } from "@/lib/googleSheets";
import { isClassMature, TREND_MATURITY_YEARS } from "@/lib/classMaturity";

export const metadata = {
  title: "Analytics Dashboard — Dynasty Database",
};

export default async function AnalyticsPage() {
  const { prospects, tierSummary, classTrend } = await getSheetData();

  // Average Score by Draft Class shows every tracked class — no
  // maturity filter, since Approximate Value here is just an average
  // of whatever's been recorded, not a claim about outcome accuracy.
  // Sorted most-recent-first so the newest class shows on the left.
  const avByRound = [...classTrend]
    .sort((a, b) => Number(b.classYear) - Number(a.classYear))
    .map((c) => ({
      label: c.classYear,
      rounds: [c.round1AV, c.round2AV, c.round3AV, c.round4AV],
    }));

  // Historical Draft Trends (hit rate) specifically needs real NFL
  // outcome history to mean anything — only mature classes qualify.
  const hitRateByRound = [...classTrend]
    .filter((c) => isClassMature(c.classYear))
    .sort((a, b) => Number(b.classYear) - Number(a.classYear))
    .map((c) => ({
      label: c.classYear,
      rounds: [c.round1HitRate, c.round2HitRate, c.round3HitRate, c.round4HitRate],
    }));

  return (
    <main>
      {/* HEADER */}
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                Analytics
              </span>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                Dashboard
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Class benchmarks and model performance, computed live.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* QUICK STATS */}
      <section className="bg-void py-10">
        <Container>
          <DashboardStats prospects={prospects} />
        </Container>
      </section>

      {/* ROUND BREAKDOWN CHARTS */}
      <section className="border-t border-border bg-surface py-10">
        <Container>
          <div className="grid grid-cols-1 gap-6">
            <DashboardCard
              title="Average Score by Draft Class"
              description="Average Value by round, per draft class."
            >
              <RoundBreakdownChart
                data={avByRound}
                emptyMessage="No classes have enough NFL history yet."
              />
            </DashboardCard>

            <DashboardCard
              title="Historical Draft Trends"
              description={`Real hit rate by round, per draft class. A class needs more than ${TREND_MATURITY_YEARS} years of NFL history before it's shown.`}
            >
              <RoundBreakdownChart
                data={hitRateByRound}
                valueSuffix="%"
                emptyMessage="Trend data will appear once a class has had time to develop."
              />
            </DashboardCard>
          </div>
        </Container>
      </section>

      {/* MODEL PERFORMANCE */}
      <section className="border-t border-border bg-void py-10">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              Model Performance
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
              Tier Hit Rates
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
              Share of players that produced for your fantasy football team
              within each tier of our grading system. Tap a tier to break it
              down by position.
            </p>
          </div>

          <div className="mt-10 max-w-2xl">
            <DashboardCard title="Tier Hit Rates">
              <TierHitRates rows={tierSummary} prospects={prospects} />
            </DashboardCard>
          </div>
        </Container>
      </section>
    </main>
  );
}
