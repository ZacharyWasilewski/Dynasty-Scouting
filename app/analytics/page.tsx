import { BarChart3 } from "lucide-react";
import { Container } from "@/components/layout/Container";
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
  const matureClassTrend = classTrend.filter((c) => isClassMature(c.classYear));
  const hitRateByRound = [...matureClassTrend]
    .sort((a, b) => Number(b.classYear) - Number(a.classYear))
    .map((c) => ({
      label: c.classYear,
      rounds: [c.round1HitRate, c.round2HitRate, c.round3HitRate, c.round4HitRate],
    }));

  // Per-class summary table — the supporting data layer underneath
  // the charts above. Every tracked class, most recent first.
  const classCounts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) classCounts.set(p.draftClass, (classCounts.get(p.draftClass) ?? 0) + 1);
  });
  const classSummary = [...classCounts.keys()]
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => ({
      year,
      count: classCounts.get(year) ?? 0,
      hitRate: classTrend.find((c) => c.classYear === year)?.hitRate ?? null,
      mature: isClassMature(year),
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
                Research Center
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Model performance, backtested against real NFL outcomes,
                computed live.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* 1. HEADLINE KPIS */}
      <section className="bg-void py-10">
        <Container>
          <DashboardStats prospects={prospects} />
        </Container>
      </section>

      {/* 2. MAJOR HISTORICAL CHART — the strongest "this has been tested" signal */}
      <section className="border-t border-border bg-surface py-14">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              Historical Performance
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
              Real hit rate, by round.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
              How often a grade actually matched a real NFL outcome, for
              every draft class with enough history to judge — more than{" "}
              {TREND_MATURITY_YEARS} years removed from its draft.
            </p>
          </div>

          <div className="mt-8">
            <DashboardCard title="Historical Draft Trends">
              <RoundBreakdownChart
                data={hitRateByRound}
                valueSuffix="%"
                emptyMessage="Trend data will appear once a class has had time to develop."
              />
            </DashboardCard>
          </div>
        </Container>
      </section>

      {/* 3. TIER PERFORMANCE */}
      <section className="border-t border-border bg-void py-14">
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

          <div className="mt-8 max-w-2xl">
            <DashboardCard title="Tier Hit Rates">
              <TierHitRates rows={tierSummary} prospects={prospects} />
            </DashboardCard>
          </div>
        </Container>
      </section>

      {/* 4. DRAFT-CLASS TRENDS */}
      <section className="border-t border-border bg-surface py-14">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              Draft-Class Trends
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
              Average Score by Draft Class
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
              Average Value by round, per draft class — every class
              tracked, regardless of how much NFL history it has yet.
            </p>
          </div>

          <div className="mt-8">
            <DashboardCard title="Average Score by Draft Class">
              <RoundBreakdownChart
                data={avByRound}
                emptyMessage="No classes have enough NFL history yet."
              />
            </DashboardCard>
          </div>
        </Container>
      </section>

      {/* 5. SUPPORTING DATA */}
      <section className="border-t border-border bg-void py-14">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              Class Summary
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
              Every class, at a glance.
            </h2>
          </div>

          <div className="mt-8 overflow-x-auto border border-border">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-raised">
                  <th className="border-b-2 border-border-strong px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                    Class
                  </th>
                  <th className="border-b-2 border-border-strong px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                    Prospects Graded
                  </th>
                  <th className="border-b-2 border-border-strong px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                    Hit Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {classSummary.map((c) => (
                  <tr key={c.year} className="border-t border-border transition-colors duration-150 hover:bg-surface-raised">
                    <td className="px-4 py-3 font-medium text-ink">{c.year}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-secondary">{c.count}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                      {c.mature && c.hitRate !== null ? `${c.hitRate.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>
    </main>
  );
}
