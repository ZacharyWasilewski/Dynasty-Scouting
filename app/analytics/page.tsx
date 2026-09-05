import { BarChart3 } from "@/components/ui/SiteIcons";
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
import { AnalyticsPositionProvider } from "@/components/analytics/AnalyticsPositionContext";
import { LeagueFormatToggle } from "@/components/analytics/LeagueFormatToggle";
import { CalibrationCurveChart } from "@/components/analytics/CalibrationCurveChart";
import { SubScoreSignalChart } from "@/components/analytics/SubScoreSignalChart";
import { OpportunityHitRateChart } from "@/components/analytics/OpportunityHitRateChart";
import { ModelValidationStory } from "@/components/analytics/ModelValidationStory";
import { ModelVsCapitalSummary } from "@/components/analytics/ModelVsCapitalSummary";
import { WhatDDAdds } from "@/components/analytics/WhatDDAdds";
import { getProspects } from "@/lib/googleSheets";
import { isClassMature } from "@/lib/classMaturity";
import { draftClassesInData, computeSubScoreSignals, computeOpportunityHitRates } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Analytics Dashboard, Dynasty Database",
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
  // "Average DD Score by Round" only includes classes that actually have
  // drafted DD Score data. This advances automatically as future classes are
  // drafted instead of relying on a hardcoded list of currently-upcoming years.
  const roundValueClassYears = allClassYears.filter((year) =>
    prospects.some((p) => p.draftClass === year && p.hasDraftData === true)
  );

  // Per-class summary — count and top prospect are format/scoring-mode
  // independent, so these stay server-computed; the 1st Round column
  // itself is computed client-side inside ClassSummaryTable since it
  // depends on both toggles.
  const classCounts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) classCounts.set(p.draftClass, (classCounts.get(p.draftClass) ?? 0) + 1);
  });
  const classSummaryRows: ClassSummaryRow[] = [...allClassYears]
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => ({
      year,
      count: classCounts.get(year) ?? 0,
    }));

  return (
    <ScoringModeProvider>
      <LeagueFormatProvider>
        <AnalyticsPositionProvider>
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

          {/* Sticky, not buried partway down the page like the old
              version — on a page this long (confirmed directly from
              screenshots: this is by far the longest page on the
              site on mobile), a nav that scrolls away with everything
              else stops being useful the moment you actually need it.
              top-16 matches the main site navbar's own height (h-16)
              exactly, so this sits directly below it with no gap or
              overlap; z-40 keeps it stacked under the navbar's own
              z-50 if they ever touch during a fast scroll. */}
          <nav
            aria-label="Analytics sections"
            className="sticky top-16 z-40 flex gap-x-5 overflow-x-auto border-b border-border bg-surface/95 px-4 py-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary backdrop-blur-md sm:px-6 lg:px-8"
          >
            <a href="#performance" className="shrink-0 hover:text-accent">Performance</a>
            <a href="#score-quality" className="shrink-0 hover:text-accent">Score Quality</a>
            <a href="#historical" className="shrink-0 hover:text-accent">Historical</a>
          </nav>

          {/* Scale/scope numbers now come before the individual
              Model Hit/Miss story cards below, not after — showing
              specific anecdotal examples before establishing how
              much real data backs them (1000+ prospects, 14 classes)
              reads as cherry-picking; leading with the scale first is
              the more natural, credibility-building order. */}
          <section className="bg-void py-10">
            <Container>
              <DashboardStats prospects={prospects} />
            </Container>
          </section>

          <ModelValidationStory prospects={prospects} />

          {/* PERFORMANCE — the core proof that the model has been tested. */}
          <section id="performance" className="scroll-mt-28 border-t border-border bg-surface py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Performance</span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  How the model holds up when the picks are real.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Two complementary tests: how DD Score performs by rookie-draft range, and whether the model can add signal beyond NFL draft capital alone.
                </p>
              </div>

              {/* Promoted to its own full-width, headline section
                  rather than living only inside the smaller side-panel
                  chart below — this is the single question a fantasy
                  player actually wants answered ("is this worth
                  trusting over just following draft position"), so it
                  gets real visual weight, not a secondary chart. */}
              <div className="mt-8">
                <ModelVsCapitalSummary prospects={prospects} />
                <div className="mt-5"><WhatDDAdds prospects={prospects} /></div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
                <DashboardCard title="Hit Rate by DD-Score Round">
                  <DDScoreRoundHitRateChart prospects={prospects} classYears={matureClassYears} />
                </DashboardCard>
                <DashboardCard title="Hit Rate: Model vs. Draft Capital">
                  <CapitalVsModelChart prospects={prospects} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* SCORE QUALITY — calibration, inputs and opportunity belong together. */}
          <section id="score-quality" className="scroll-mt-28 border-t border-border bg-void py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Score Quality</span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  What the score means and which signals drive it.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Calibration checks whether higher scores have actually translated into better outcomes. The supporting studies show what each model input and opportunity signal adds to the evaluation.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <DashboardCard title="How Well DD Score Predicts Real Outcomes">
                  <CalibrationCurveChart prospects={prospects} />
                </DashboardCard>
                <DashboardCard title="Sub-Score Signal by Position">
                  <SubScoreSignalChart signals={subScoreSignals} />
                </DashboardCard>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
                <DashboardCard title="Tier Hit Rates">
                  <TierHitRates prospects={prospects} />
                </DashboardCard>
                <DashboardCard title="Hit Rate by Opportunity Label">
                  <OpportunityHitRateChart data={opportunityHitRates} />
                </DashboardCard>
              </div>
            </Container>
          </section>

          {/* HISTORICAL — class trends and the archive in one research chapter. */}
          <section id="historical" className="scroll-mt-28 border-t border-border bg-surface py-14">
            <Container>
              <div className="max-w-2xl">
                <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Historical Archive</span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  Every class, measured on the same scale.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  See how rookie-draft value has changed across classes, then explore the full historical database in one place.
                </p>
              </div>

              <div className="mt-8">
                <DashboardCard title="Average DD Score by Round">
                  <DDScoreRoundValueChart prospects={prospects} classYears={roundValueClassYears} />
                </DashboardCard>
              </div>
              <div className="mt-5">
                <DashboardCard title="Every Class, at a Glance">
                  <ClassSummaryTable prospects={prospects} rows={classSummaryRows} />
                </DashboardCard>
              </div>
            </Container>
          </section>
        </main>
        </AnalyticsPositionProvider>
      </LeagueFormatProvider>
    </ScoringModeProvider>
  );
}
