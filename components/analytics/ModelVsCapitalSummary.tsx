"use client";

import { useMemo } from "react";
import type { Prospect } from "@/types/prospect";
import { computeCapitalVsModelHitRates } from "@/lib/analytics";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

/**
 * Every number here is computed live from computeCapitalVsModelHitRates
 * — the exact same function CapitalVsModelChart already renders, not a
 * second copy of the comparison logic. This component only adds
 * aggregation (a single overall rate, and per-tier winner labels) on
 * top of data that already exists; it introduces no new statistic and
 * no hardcoded claim about which approach is "better." Whatever the
 * real numbers say is what renders — if the pattern is mixed, the
 * copy below reflects that rather than picking a side.
 */
export function ModelVsCapitalSummary({ prospects }: { prospects: Prospect[] }) {
  const { selection } = useLeagueFormat();
  const { mode } = useScoringMode();
  const weighted = mode === "weighted";

  const { overallModel, overallCapital, tierResults, totalN, headlineN } = useMemo(() => {
    const data = computeCapitalVsModelHitRates(prospects, selection);

    const tierResults = data.map((d) => {
      const modelVal = weighted ? d.modelValueScore : d.modelHitRate;
      const capitalVal = weighted ? d.capitalValueScore : d.capitalHitRate;
      let winner: "model" | "capital" | "tie" | null = null;
      if (modelVal !== null && capitalVal !== null) {
        // A display tie band only; this is not a significance test.
        const diff = modelVal - capitalVal;
        winner = Math.abs(diff) < 1.5 ? "tie" : diff > 0 ? "model" : "capital";
      }
      return { tier: d.tier, modelVal, capitalVal, winner, n: d.modelCount };
    }).filter(d => d.n > 0);

    return {
      overallModel: data[0]?.modelHitRate ?? null,
      overallCapital: data[0]?.capitalHitRate ?? null,
      tierResults,
      headlineN: data[0]?.modelCount ?? 0,
      totalN: data.reduce((sum, d) => sum + d.modelCount, 0),
    };
  }, [prospects, selection, weighted]);

  const modelWins = tierResults.filter((t) => t.winner === "model").length;
  const capitalWins = tierResults.filter((t) => t.winner === "capital").length;
  const ties = tierResults.filter((t) => t.winner === "tie").length;

  // The honest, evidence-based sentence — built from the actual
  // per-tier tally above, not a template that assumes a winner. Every
  // real outcome (model ahead, capital ahead, split, too close to
  // call) gets its own accurate phrasing rather than being forced
  // into "the model wins" copy.
  const verdict =
    modelWins > 0 && capitalWins === 0
      ? `The model matched or outperformed draft capital in every tier tested${ties > 0 ? `, tying in ${ties}` : ""}.`
      : capitalWins > 0 && modelWins === 0
      ? `Draft capital matched or outperformed the model in every tier tested${ties > 0 ? `, tying in ${ties}` : ""}.`
      : modelWins > capitalWins
      ? `The model came out ahead in ${modelWins} of ${tierResults.length} tiers, draft capital in ${capitalWins}${ties > 0 ? `, with ${ties} too close to call` : ""} — an edge, not a clean sweep.`
      : capitalWins > modelWins
      ? `Draft capital came out ahead in ${capitalWins} of ${tierResults.length} tiers, the model in ${modelWins}${ties > 0 ? `, with ${ties} too close to call` : ""}.`
      : `The two approaches split evenly across the tiers tested — neither consistently outperforms the other on this data.`;

  if (totalN === 0) return null;

  return (
    <div className="border border-border-strong bg-surface p-6 sm:p-8">
      <span className="font-headline text-sm uppercase text-accent">What Does The Model Add?</span>
      <h3 className="mt-2 font-display text-xl font-semibold tracking-tightest text-ink sm:text-2xl">
        Dynasty Database Model vs. Draft Capital
      </h3>

      {!weighted && overallModel !== null && overallCapital !== null && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="border border-border bg-void/20 p-4">
            <p className="font-headline text-sm uppercase text-ink-tertiary">DD Score</p>
            <p className="mt-1 font-data text-3xl font-bold tabular-nums text-accent">{overallModel.toFixed(0)}%</p>
            <p className="mt-1 text-[11px] text-ink-tertiary">top cohort hit rate · n={headlineN}</p>
          </div>
          <div className="border border-border bg-void/20 p-4">
            <p className="font-headline text-sm uppercase text-ink-tertiary">Draft Capital</p>
            <p className="mt-1 font-data text-3xl font-bold tabular-nums text-ink-secondary">{overallCapital.toFixed(0)}%</p>
            <p className="mt-1 text-[11px] text-ink-tertiary">top cohort hit rate · n={headlineN}</p>
          </div>
        </div>
      )}

      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-secondary">{verdict}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tierResults.map((t) => (
          <span
            key={t.tier}
            className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary"
            title={`n=${t.n} each`}
          >
            {t.tier} (n={t.n}):{" "}
            <span
              className={
                t.winner === "model" ? "text-accent" : t.winner === "capital" ? "text-ink-secondary" : "text-ink-tertiary"
              }
            >
              {t.winner === "model" ? "Model" : t.winner === "capital" ? "Capital" : t.winner === "tie" ? "Even" : "—"}
            </span>
          </span>
        ))}
      </div>

      {/* An explicit, named "where it falls short" moment — the honest
          data already exists above as small color-coded chips, but a
          chip color is easy to skim past. "What it adds" gets a
          dedicated verdict sentence; the failure case deserves the
          same treatment, not just a quieter visual signal, or the
          page reads as more one-sided than the actual numbers are.
          Only renders when draft capital has genuinely won at least
          one tier — never fabricated, and silent (not "we found no
          weaknesses") when the data doesn't support showing it. */}
      {capitalWins > 0 && (
        <div className="mt-5 border-l-2 border-ink-tertiary/40 pl-4">
          <p className="font-headline text-sm uppercase text-ink-tertiary">Where It Falls Short</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Draft capital outperformed the model in{" "}
            {tierResults.filter((t) => t.winner === "capital").map((t) => t.tier).join(" and ")}. In{" "}
            {capitalWins === 1 ? "this tier" : "these tiers"}, where a player actually got drafted was a better signal
            than the model&apos;s own score.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-tertiary">
        Headline: model top N versus actual picks 1–32, where N is the eligible top-32 sample. Each tier compares the model&apos;s top prospects by DD Score against players in the matching draft-capital range,
        same cohort size and resolved hit/miss outcomes. These are retrospective current-model results, not held-out validation; small differences do not establish statistical significance.
      </p>
    </div>
  );
}
