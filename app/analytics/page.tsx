import { BarChart3 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { DashboardStats } from "@/components/analytics/DashboardStats";
import { DashboardCard } from "@/components/analytics/DashboardCard";
import { TierHitRates } from "@/components/analytics/TierHitRates";
import { CapitalVsModelChart } from "@/components/analytics/CapitalVsModelChart";
import { DDScoreRoundHitRateChart } from "@/components/analytics/DDScoreRoundHitRateChart";
import { DDScoreRoundValueChart } from "@/components/analytics/DDScoreRoundValueChart";
import { ClassSummaryTable, type ClassSummaryRow } from "@/components/analytics/ClassSummaryTable";
import { ScoringModeProvider } from "@/components/analytics/ScoringModeContext";
import { ScoringModeToggle } from "@/components/analytics/ScoringModeToggle";
import { LeagueFormatProvider } from "@/components/analytics/LeagueFormatContext";
import { LeagueFormatToggle } from "@/components/analytics/LeagueFormatToggle";
import { CalibrationCurveChart } from "@/components/analytics/CalibrationCurveChart";
import { SubScoreSignalChart } from "@/components/analytics/SubScoreSignalChart";
import { OpportunityHitRateChart } from "@/components/analytics/OpportunityHitRateChart";
import { getProspects } from "@/lib/googleSheets";
import { isClassMature } from "@/lib/classMaturity";
import { draftClassesInData, computeSubScoreSignals, computeOpportunityHitRates } from "@/lib/analytics";

export const revalidate = 60;

export const metadata = {
  title: "Analytics Dashboard — Dynasty Database",
};

export default async function AnalyticsPage() {
  const prospects = await getProspects();
  const subScoreSignals = computeSubScoreSignals(prospects);
  const opportunityHitRates = computeOpportunityHitRates(prospects);

  // Every round-based chart on this page now buckets by the model's
  // own DD-Score ranking (top 12, next 12, ...) instead of real NFL
  // round data pulled from the sheet — so class years come straight
  // from the prospect pool, not a separate sheet table.
  const allClassYears = draftClassesInData(prospects);
  const matureClassYears = allClassYears.filter(isClassMature);
  // "Average DD Score by Round" excludes classes still in progress —
  // 2027/2028 have no real DD Score yet (it requires an actual draft
  // slot) and would just show as empty columns.
  const roundValueClassYears = allClassYears.filter((y) => y !== "2027" && y !== "2028");

  // Per-class summary — count and top prospect are format/scoring-mode
  // independent, so these stay server-computed; the 1st Round column
  // itself is computed client-side inside ClassSummaryTable since it
  // depends on both toggles.
  const classCounts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) classCounts.set(p.draftClass, (classCounts.get(p.draftClass) ?? 0) + 1);
  });
  const classSummaryRows: ClassSummaryRow[] = [...classCounts.keys()]
    .filter((year) => year !== "2010" && year !== "2013")
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => {
      const topProspect = prospects
        .filter((p) => p.draftClass === year && p.rank !== undefined)
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
      return { year, count: classCounts.get(year) ?? 0, topProspect };
    });

  return (
    <ScoringModeProvider>
      <LeagueFormatProvider>
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
                  <h1 className="mt-1 font-headline text-3xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
                    Research Center
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                    Model performance, backtested against real NFL outcomes,
                    computed live from DD Score.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <ScoringModeToggle />
                <LeagueFormatToggle />
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
                  Hit Rate by Round
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Percentage of players that produced for your dynasty
                  fantasy football team based on where they were picked in
                  your league rookie drafts. Rounds are based on a 12 team
                  format.
                </p>
              </div>

              <div className="mt-8">
                <DashboardCard title="Hit Rate by DD-Score Round">
                  <DDScoreRoundHitRateChart prospects={prospects} classYears={matureClassYears} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* 2.5 MODEL VS. DRAFT CAPITAL — same cohort, two rankings */}
          <section className="border-t border-border bg-void py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                  Model vs. Draft Capital
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  Can the model beat the NFL&apos;s own draft order?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Players are sorted into 5 buckets based on NFL draft
                  capital. Each bucket contains &ldquo;n&rdquo; prospects, we
                  match the same number of our top prospects and then
                  compare hit rates of how Dynasty Database graded the
                  player compared to NFL Draft capital alone.
                </p>
              </div>

              <div className="mt-8 max-w-2xl">
                <DashboardCard title="Hit Rate: Model vs. Draft Capital">
                  <CapitalVsModelChart prospects={prospects} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* 2.6 CALIBRATION CURVE — the model's own inputs, exposed */}
          <section className="border-t border-border bg-surface py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                  Model Transparency
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  Does our score actually predict success?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Every player gets a score from 0 to 100. This checks
                  whether that number has actually meant anything: for
                  real past players near each score, what share of
                  them turned into fantasy-relevant players once their
                  careers played out? It&apos;s not a projection —
                  it&apos;s what already happened.
                </p>
              </div>

              <div className="mt-8 max-w-2xl">
                <DashboardCard title="How Well DD Score Predicts Real Outcomes">
                  <CalibrationCurveChart prospects={prospects} />
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
                  <TierHitRates prospects={prospects} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* 3.5 SUB-SCORE SIGNAL — which inputs actually carry signal, per position */}
          <section className="border-t border-border bg-surface py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                  Model Transparency
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  Which inputs actually predict hitting?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  DD Score blends 4 sub-scores per position into one
                  number. This isolates each one on its own — comparing
                  the real hit rate for players in the top third on
                  that single metric against players in the bottom
                  third.
                </p>
              </div>

              <div className="mt-8 max-w-2xl">
                <DashboardCard title="Sub-Score Signal by Position">
                  <SubScoreSignalChart signals={subScoreSignals} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* 3.6 OPPORTUNITY HIT RATES — the one sub-score that's a label, not a percentile */}
          <section className="border-t border-border bg-void py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                  Model Transparency
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  Does a player&apos;s real role predict hitting?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Opportunity is shown on every profile as a real
                  label — &ldquo;QB1&rdquo;, &ldquo;Committee&rdquo;,
                  and so on — instead of a score. This shows the actual
                  hit rate for every player who carried each label, by
                  position.
                </p>
              </div>

              <div className="mt-8 max-w-2xl">
                <DashboardCard title="Hit Rate by Opportunity Label">
                  <OpportunityHitRateChart data={opportunityHitRates} />
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
                  How every class grades out, DD-Score round by round.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Average score per round of your dynasty rookie drafts
                  using our Dynasty Database scoring model. Rounds base on
                  12 team formats.
                </p>
              </div>

              <div className="mt-8">
                <DashboardCard title="Average DD Score by Round">
                  <DDScoreRoundValueChart prospects={prospects} classYears={roundValueClassYears} />
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

              <div className="mt-8">
                <ClassSummaryTable prospects={prospects} rows={classSummaryRows} />
              </div>
            </Container>
          </section>
        </main>
      </LeagueFormatProvider>
    </ScoringModeProvider>
  );
}
