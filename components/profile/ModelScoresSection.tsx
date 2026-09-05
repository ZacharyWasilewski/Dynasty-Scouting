"use client";

import { useMemo } from "react";
import { ArrowRight } from "@/components/ui/SiteIcons";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { getTierColor, getPositionalTierForScore } from "@/lib/tiers";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";

type ProgressStageKey = "raw" | "preDraft" | "positional" | "dd";

type ProgressPoint = {
  key: ProgressStageKey;
  label: string;
  score: number;
  rank: number;
  total: number;
};

const PROGRESS_STAGES: Array<{ key: ProgressStageKey; label: string }> = [
  { key: "raw", label: "Raw" },
  { key: "preDraft", label: "Pre-Draft" },
  { key: "positional", label: "Positional" },
  { key: "dd", label: "DD Score" },
];

function scoreAtStage(prospect: Prospect, key: ProgressStageKey, format: LeagueFormat): number | undefined {
  switch (key) {
    case "raw":
      return applyFormatAdjustment(prospect.rawScore, prospect.position, format);
    case "preDraft":
      return applyFormatAdjustment(prospect.preDraftScore, prospect.position, format);
    case "positional":
      return applyFormatAdjustment(prospect.grade?.overall ?? prospect.positionalScore, prospect.position, format);
    case "dd":
      return prospect.hasDraftData === true ? getDDScore(prospect, format) : undefined;
  }
}

function formatFromParam(value: string | null): LeagueFormat {
  return value === "1qb" ? "1QB"
    : value === "sf" ? "SUPERFLEX"
    : value === "1qb-tep" ? "1QB_TEP"
    : value === "sf-tep" ? "SUPERFLEX_TEP"
    : "SUPERFLEX";
}

/**
 * The four underlying model scores and the compact class-rank progression.
 * Both pieces describe the same evaluation process, so keeping them together
 * gives the user score context and class movement without a redundant full-width
 * chart. Every value remains format-aware and is calculated from the live class pool.
 */
export function ModelScoresSection({
  prospect,
  classPool = [],
}: {
  prospect: Prospect;
  classPool?: Prospect[];
}) {
  const searchParams = useSearchParams();
  const format = formatFromParam(searchParams.get("format"));

  const rawScore = scoreAtStage(prospect, "raw", format);
  const preDraftScore = scoreAtStage(prospect, "preDraft", format);
  const positionalScore = scoreAtStage(prospect, "positional", format);
  const opportunityScore = applyFormatAdjustment(prospect.opportunityScore, prospect.position, format);

  const progression = useMemo<ProgressPoint[]>(() => {
    if (classPool.length < 2) return [];

    return PROGRESS_STAGES.flatMap((stage) => {
      const targetScore = scoreAtStage(prospect, stage.key, format);
      if (typeof targetScore !== "number" || !Number.isFinite(targetScore)) return [];

      const ranked = classPool
        .map((candidate) => ({
          prospect: candidate,
          score: scoreAtStage(candidate, stage.key, format),
        }))
        .filter((entry): entry is { prospect: Prospect; score: number } => Number.isFinite(entry.score))
        .sort((a, b) =>
          b.score - a.score ||
          a.prospect.name.localeCompare(b.prospect.name) ||
          a.prospect.id.localeCompare(b.prospect.id),
        );

      const rank = ranked.findIndex((entry) => entry.prospect.id === prospect.id) + 1;
      if (rank <= 0) return [];

      return [{
        key: stage.key,
        label: stage.label,
        score: targetScore,
        rank,
        total: ranked.length,
      }];
    });
  }, [prospect, classPool, format]);

  const firstPoint = progression[0];
  const lastPoint = progression[progression.length - 1];
  const hasFullProgression = progression.length === PROGRESS_STAGES.length;
  const moved = hasFullProgression && firstPoint && lastPoint ? firstPoint.rank - lastPoint.rank : 0;
  const movementLabel = !hasFullProgression
    ? "Awaiting stages"
    : moved > 0
      ? `Up ${moved} spot${moved === 1 ? "" : "s"}`
      : moved < 0
        ? `Down ${Math.abs(moved)} spot${Math.abs(moved) === 1 ? "" : "s"}`
        : "Held position";

  const stageInfo: Record<ProgressStageKey, string> = {
    raw: "How we judge a player based on raw college production. This score ignores mock draft data, opportunity, and real life draft position.",
    preDraft: "Calculated before the NFL Draft using the same metrics while using mock draft data in place of a player's actual draft position and ignoring opportunity.",
    positional: "The player's core positional grade, calculated from the weighted profile metrics and smaller backend adjustments. It is the primary input to Dynasty Database Score.",
    dd: "The final Dynasty Database Score, which adds the complete evaluation context and opportunity to the player's core model grade.",
  };

  const stageColor = (score: number) =>
    getTierColor(getPositionalTierForScore(score) ?? "Roster Clogger");

  return (
    <section id="class-progression" className="border-b border-border bg-surface py-7 sm:py-8">
      <Container>
        <SectionHeading
          eyebrow="Class Progression"
          title="How the model moved the player through the class"
          description="Each stage combines the player's model score with their live rank in this class. Lower rank is better as more context is added to the evaluation."
        />

        {progression.length >= 1 ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-void/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary sm:text-xs">
                First to latest stage
              </div>
              <div className="border border-border bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-accent sm:text-xs">
                {movementLabel}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)_12px_minmax(0,1fr)_12px_minmax(0,1fr)] items-start gap-y-3 sm:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)]">
              {PROGRESS_STAGES.flatMap((stage, index) => {
                const point = progression.find((entry) => entry.key === stage.key);
                const score = point?.score;
                const cells = [
                  <div key={stage.key} className="flex min-w-0 flex-col items-center text-center">
                    <ScoreRing
                      label={stage.label}
                      value={score}
                      size={68}
                      info={stageInfo[stage.key]}
                      color={score !== undefined ? stageColor(score) : undefined}
                      infoPosition="label"
                    />
                    <div className="mt-1.5 font-data text-xl font-semibold leading-none text-accent sm:text-2xl">
                      {point ? `#${point.rank}` : "—"}
                    </div>
                    <div className="mt-1 whitespace-nowrap text-[10px] leading-none text-ink-tertiary sm:text-xs">
                      {point ? `of ${point.total}` : "Awaiting data"}
                    </div>
                  </div>,
                ];

                if (index < PROGRESS_STAGES.length - 1) {
                  cells.push(
                    <div key={`${stage.key}-arrow`} className="flex h-[68px] items-center justify-center pt-0.5 text-ink-tertiary sm:h-20">
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} />
                    </div>,
                  );
                }

                return cells;
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 sm:flex-nowrap">
              <div className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary sm:text-xs">Opportunity independent</div>
              <div className="hidden h-8 w-px shrink-0 bg-border sm:block" />
              <div className="font-headline text-2xl leading-none text-ink tabular-nums sm:text-3xl">
                {typeof opportunityScore === "number" && Number.isFinite(opportunityScore) ? opportunityScore.toFixed(1) : "—"}
              </div>
              <div className="basis-full text-xs leading-relaxed text-ink-tertiary sm:basis-auto sm:text-sm">Quantitative model without qualitative opportunity</div>
            </div>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-2 gap-5 rounded-2xl border border-border bg-void/30 p-5 sm:grid-cols-4">
            <ScoreRing label="Raw" value={rawScore} size={96} info={stageInfo.raw} color={rawScore !== undefined ? stageColor(rawScore) : undefined} />
            <ScoreRing label="Pre-Draft" value={preDraftScore} size={96} info={stageInfo.preDraft} color={preDraftScore !== undefined ? stageColor(preDraftScore) : undefined} />
            <ScoreRing label="Positional" value={positionalScore} size={96} info={stageInfo.positional} color={positionalScore !== undefined ? stageColor(positionalScore) : undefined} />
            {(() => {
              const ddScore = prospect.hasDraftData ? getDDScore(prospect, format) : undefined;
              return (
                <ScoreRing
                  label="DD Score"
                  value={ddScore}
                  size={96}
                  info={stageInfo.dd}
                  color={ddScore !== undefined ? stageColor(ddScore) : undefined}
                />
              );
            })()}
          </div>
        )}
      </Container>
    </section>
  );
}
