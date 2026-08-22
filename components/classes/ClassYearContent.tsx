"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { Prospect, Tier } from "@/types/prospect";
import { Container } from "@/components/layout/Container";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { getDDTier, type LeagueFormat } from "@/lib/ddScore";
import { getTierColor, getTierForScore, TIER_DEFINITIONS } from "@/lib/tiers";

// A prospect's tier for the "Class at a Glance" summary — now format-
// aware. Real, reported bug this replaces: the summary used to
// always compute against a fixed 1QB baseline no matter which format
// the rankings table below was actually showing, so the Elite+ rate
// and tier distribution silently stopped matching the table the
// moment someone toggled format — the same class of inconsistency
// already fixed once on the player profile's Class Rank.
function tierForProspect(p: Prospect, format: LeagueFormat): Tier | undefined {
  if (p.hasDraftData === true) return getDDTier(p, format);
  return getTierForScore(p.preDraftScore);
}

function eliteRate(prospects: Prospect[], format: LeagueFormat): number | undefined {
  let eliteCount = 0;
  let total = 0;
  for (const p of prospects) {
    const tier = tierForProspect(p, format);
    if (!tier) continue;
    total++;
    if (tier === "Generational" || tier === "Elite") eliteCount++;
  }
  return total > 0 ? (eliteCount / total) * 100 : undefined;
}

function scoreForProspect(p: Prospect, format: LeagueFormat): number | undefined {
  if (p.hasDraftData === true) {
    if (format === "1QB") return p.ddScore1QB;
    if (format === "1QB_TEP") return p.ddScore1QBTEP;
    if (format === "SUPERFLEX") return p.ddScoreSuperflex;
    return p.ddScoreSuperflexTEP;
  }
  return p.preDraftScore;
}

function computeClassSummary(classProspects: Prospect[], allProspects: Prospect[], format: LeagueFormat) {
  const tierCounts: Record<string, number> = {};
  let resolvedCount = 0;
  for (const p of classProspects) {
    const tier = tierForProspect(p, format);
    if (tier) {
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
      resolvedCount++;
    }
  }

  const ranked = [...classProspects].sort((a, b) => {
    const aDrafted = a.hasDraftData === true;
    const bDrafted = b.hasDraftData === true;
    if (aDrafted !== bDrafted) return aDrafted ? -1 : 1;
    return (scoreForProspect(b, format) ?? -Infinity) - (scoreForProspect(a, format) ?? -Infinity);
  });
  const topProspect = ranked.length > 0 ? ranked[0] : undefined;

  return {
    tierCounts,
    resolvedCount,
    classEliteRate: eliteRate(classProspects, format),
    allTimeEliteRate: eliteRate(allProspects, format),
    topProspect,
  };
}

export function ClassYearContent({
  prospects,
  allProspects,
}: {
  /** Just this class's prospects, for the rankings table and the class-scoped half of the summary. */
  prospects: Prospect[];
  /** The full database, only needed for the "vs. database average" comparison. */
  allProspects: Prospect[];
}) {
  // Mirrors RankingsTable's own format state via onFormatChange —
  // this component doesn't try to independently guess the format
  // (URL params, back-navigation, sticky preference); it just stays
  // in sync with whatever the table below actually resolves to.
  const [format, setFormat] = useState<LeagueFormat>("1QB");
  const handleFormatChange = useCallback((next: LeagueFormat) => setFormat(next), []);

  const summary = computeClassSummary(prospects, allProspects, format);
  const topTier = summary.topProspect ? tierForProspect(summary.topProspect, format) : undefined;

  return (
    <>
      {summary.resolvedCount > 0 && (
        <section className="border-b border-border bg-surface">
          <Container className="py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
              <div className="lg:w-64 lg:shrink-0">
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
                  Class Strength
                </span>
                {summary.classEliteRate !== undefined && summary.allTimeEliteRate !== undefined && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                    <span className="font-headline text-3xl text-ink">
                      {summary.classEliteRate.toFixed(0)}%
                    </span>{" "}
                    of this class graded Elite or higher —{" "}
                    {summary.classEliteRate >= summary.allTimeEliteRate ? "above" : "below"} the{" "}
                    {summary.allTimeEliteRate.toFixed(0)}% database average.
                  </p>
                )}
                {summary.topProspect && topTier && (
                  <p className="mt-4 text-xs leading-relaxed text-ink-tertiary">
                    Highest graded:{" "}
                    <Link
                      href={`/players/${summary.topProspect.id}`}
                      prefetch={false}
                      className="font-semibold text-ink hover:text-accent"
                    >
                      {summary.topProspect.name}
                    </Link>{" "}
                    <span style={{ color: getTierColor(topTier) }}>({topTier})</span>
                  </p>
                )}
              </div>

              <div className="flex-1">
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
                  Tier Distribution
                </span>
                <div className="mt-3 flex flex-col gap-2">
                  {(() => {
                    const activeTiers = TIER_DEFINITIONS.filter((t) => (summary.tierCounts[t.name] ?? 0) > 0);
                    const maxCount = Math.max(...activeTiers.map((t) => summary.tierCounts[t.name] ?? 0));
                    return activeTiers.map((tier) => {
                      const count = summary.tierCounts[tier.name] ?? 0;
                      const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={tier.name} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-tertiary sm:w-32">
                            {tier.name}
                          </span>
                          <div className="h-2 flex-1 bg-border-strong/40">
                            <div
                              className="h-full transition-[width] duration-300"
                              style={{ width: `${widthPct}%`, backgroundColor: tier.color }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right font-mono text-[11px] font-semibold text-ink">
                            {count}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </Container>
        </section>
      )}

      <section className="bg-void py-10">
        <Container>
          <RankingsTable
            prospects={prospects}
            showBigBoardDividers
            rankScope="collection"
            onFormatChange={handleFormatChange}
          />
        </Container>
      </section>
    </>
  );
}
