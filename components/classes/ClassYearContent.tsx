"use client";

import { playerHref } from "@/lib/playerLinks";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { Prospect, Tier } from "@/types/prospect";
import { Container } from "@/components/layout/Container";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { getDDTier, type LeagueFormat } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { formatAdjustment } from "@/lib/formatAdjustment";
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
  // Real gap this closes: this used to call getTierForScore directly
  // on the raw p.preDraftScore, which was correct at the time this
  // function was first written — getDisplayedPreDraftScore didn't
  // accept a format parameter yet. That capability was added later
  // (for the TEP/SF devy adjustment), but this call site was never
  // updated to actually use it, so this summary kept computing
  // against the flat, unadjusted score even after the rest of the
  // site started respecting format for devy prospects.
  return getTierForScore(getDisplayedPreDraftScore(p, format));
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

// Upcoming/devy classes should never be judged against final DD Score
// outcomes. Historical prospects are compared at the same PRE-DRAFT stage,
// using the pre-draft value that was recorded for them and the exact same
// format adjustment currently applied to a live devy board.
function preDraftScoreForComparison(p: Prospect, format: LeagueFormat): number | undefined {
  if (p.preDraftScore === undefined) return undefined;
  return Math.max(0, Math.min(100, p.preDraftScore + formatAdjustment(p.position, format)));
}

function preDraftTierForComparison(p: Prospect, format: LeagueFormat): Tier | undefined {
  return getTierForScore(preDraftScoreForComparison(p, format));
}

function preDraftEliteCount(prospects: Prospect[], format: LeagueFormat): number {
  let eliteCount = 0;
  for (const p of prospects) {
    const tier = preDraftTierForComparison(p, format);
    if (tier === "Generational" || tier === "Elite") eliteCount++;
  }
  return eliteCount;
}

const MIN_FINALIZED_CLASS_YEAR = 2015;

// Upcoming/devy classes are normalized against the size of actual finalized
// draft classes only. This intentionally excludes both pre-2015 classes and
// any live devy/upcoming class, whose prospect pools are still fluid.
function historicalPreDraftClasses(prospects: Prospect[], classYear: string): Prospect[][] {
  const targetYear = Number(classYear);
  const byYear = new Map<string, Prospect[]>();

  for (const p of prospects) {
    const year = Number(p.draftClass);
    if (!p.draftClass || !Number.isFinite(year)) continue;
    if (year < MIN_FINALIZED_CLASS_YEAR || year >= targetYear) continue;
    if (p.hasDraftData !== true) continue;
    if (p.preDraftScore === undefined) continue;

    const group = byYear.get(p.draftClass) ?? [];
    group.push(p);
    byYear.set(p.draftClass, group);
  }

  return [...byYear.values()].filter((group) => group.length > 0);
}

// Finalized class size is calculated independently of pre-draft score
// availability so the denominator represents the real drafted class pool,
// not merely the subset with recorded historical pre-draft scores.
function finalizedHistoricalClassSizes(prospects: Prospect[], classYear: string): Prospect[][] {
  const targetYear = Number(classYear);
  const byYear = new Map<string, Prospect[]>();

  for (const p of prospects) {
    const year = Number(p.draftClass);
    if (!p.draftClass || !Number.isFinite(year)) continue;
    if (year < MIN_FINALIZED_CLASS_YEAR || year >= targetYear) continue;
    if (p.hasDraftData !== true) continue;

    const group = byYear.get(p.draftClass) ?? [];
    group.push(p);
    byYear.set(p.draftClass, group);
  }

  return [...byYear.values()].filter((group) => group.length > 0);
}

// Early devy boards intentionally contain a wider pool than a finished draft
// class. Using the live board size as the denominator would therefore dilute
// the Elite+ rate with prospects who are expected to fall out of the class.
// For upcoming classes, normalize the format-aware Elite+ count by the average
// finalized historical class size instead.
function averageHistoricalClassSize(prospects: Prospect[], classYear: string): { size: number | undefined; classesCompared: number } {
  const groups = finalizedHistoricalClassSizes(prospects, classYear);
  return {
    size: groups.length > 0 ? groups.reduce((sum, group) => sum + group.length, 0) / groups.length : undefined,
    classesCompared: groups.length,
  };
}

function normalizedPreDraftEliteRate(
  prospects: Prospect[],
  format: LeagueFormat,
  denominator: number | undefined
): number | undefined {
  if (!denominator || denominator <= 0) return undefined;
  return (preDraftEliteCount(prospects, format) / denominator) * 100;
}

// The benchmark for an upcoming class remains the actual average Elite+ rate
// produced by finalized drafted rookie classes. Only the live devy class uses
// the size-normalized denominator, because its early prospect pool is inflated.
function averageHistoricalClassEliteRate(
  prospects: Prospect[],
  classYear: string,
  format: LeagueFormat
): { rate: number | undefined; classesCompared: number } {
  const groups = finalizedHistoricalClassSizes(prospects, classYear);
  const rates = groups
    .map((group) => eliteRate(group, format))
    .filter((rate): rate is number => rate !== undefined);

  return {
    rate: rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : undefined,
    classesCompared: rates.length,
  };
}

function classStrengthPercentile(
  prospects: Prospect[],
  classYear: string,
  format: LeagueFormat,
  currentRate: number | undefined
): number | undefined {
  if (currentRate === undefined) return undefined;
  const rates = finalizedHistoricalClassSizes(prospects, classYear)
    .map((group) => eliteRate(group, format))
    .filter((rate): rate is number => rate !== undefined);
  if (!rates.length) return undefined;
  return (rates.filter((rate) => rate <= currentRate).length / rates.length) * 100;
}

function strengthLabel(isPreDraftClass: boolean) {
  // An upcoming class is still accumulating college data, so this label
  // describes the maturity of the evaluation rather than prematurely
  // issuing a final verdict on the class itself.
  return isPreDraftClass ? "Early Evaluation" : undefined;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1: return `${value}st`;
    case 2: return `${value}nd`;
    case 3: return `${value}rd`;
    default: return `${value}th`;
  }
}

function strongestPosition(classProspects: Prospect[], format: LeagueFormat): string | undefined {
  const byPosition = new Map<string, number[]>();
  for (const p of classProspects) {
    const score = scoreForProspect(p, format);
    if (score === undefined) continue;
    const scores = byPosition.get(p.position) ?? [];
    scores.push(score);
    byPosition.set(p.position, scores);
  }
  const rows = [...byPosition.entries()]
    .filter(([, scores]) => scores.length > 0)
    .map(([position, scores]) => ({ position, average: scores.reduce((sum, score) => sum + score, 0) / scores.length }))
    .sort((a, b) => b.average - a.average);
  return rows[0]?.position;
}

function scoreForProspect(p: Prospect, format: LeagueFormat): number | undefined {
  if (p.hasDraftData === true) {
    if (format === "1QB") return p.ddScore1QB;
    if (format === "1QB_TEP") return p.ddScore1QBTEP;
    if (format === "SUPERFLEX") return p.ddScoreSuperflex;
    return p.ddScoreSuperflexTEP;
  }
  // Same fix as tierForProspect above — this now correctly uses the
  // format-adjusted Pre-Draft Score, so the "highest graded" devy
  // prospect can actually change when the format toggle does (e.g.
  // a QB overtaking an RB in Superflex), matching how the drafted
  // branch above it already behaves.
  return getDisplayedPreDraftScore(p, format);
}

function computeClassSummary(classProspects: Prospect[], allProspects: Prospect[], format: LeagueFormat) {
  const classYear = classProspects[0]?.draftClass ?? "";
  const isPreDraftClass = classProspects.length > 0 && classProspects.every((p) => p.hasDraftData !== true);
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

  const historicalClassSize = isPreDraftClass
    ? averageHistoricalClassSize(allProspects, classYear)
    : { size: undefined, classesCompared: 0 };
  const classEliteRate = isPreDraftClass
    ? normalizedPreDraftEliteRate(classProspects, format, historicalClassSize.size)
    : eliteRate(classProspects, format);
  const benchmark = isPreDraftClass
    ? averageHistoricalClassEliteRate(allProspects, classYear, format)
    : { rate: eliteRate(allProspects.filter((p) => p.hasDraftData === true), format), classesCompared: 0 };
  const percentile = isPreDraftClass
    ? classStrengthPercentile(allProspects, classYear, format, classEliteRate)
    : undefined;

  return {
    tierCounts,
    resolvedCount,
    classEliteRate,
    benchmark,
    percentile,
    historicalClassSize,
    strength: strengthLabel(isPreDraftClass),
    strongestPosition: strongestPosition(classProspects, format),
    isPreDraftClass,
    topProspect,
  };
}


function HistoricalClassExplorer({ prospects, format }: { prospects: Prospect[]; format: LeagueFormat }) {
  const resolved = prospects.filter((p) => p.hasDraftData === true && p.hitMiss);
  if (!resolved.length) return null;
  const hits = resolved.filter((p) => p.hitMiss === "HIT");
  const misses = resolved.filter((p) => p.hitMiss === "MISS");
  const scored = [...resolved].sort((a, b) => (scoreForProspect(b, format) ?? -Infinity) - (scoreForProspect(a, format) ?? -Infinity));
  const modelHitRate = resolved.length ? (hits.length / resolved.length) * 100 : 0;
  const topHits = scored.filter((p) => p.hitMiss === "HIT").slice(0, 3);
  const topMisses = scored.filter((p) => p.hitMiss === "MISS").slice(0, 2);
  const avgAdp = resolved.filter((p) => p.adp !== undefined).length
    ? resolved.filter((p) => p.adp !== undefined).reduce((sum, p) => sum + (p.adp ?? 0), 0) / resolved.filter((p) => p.adp !== undefined).length
    : undefined;
  return (
    <section className="border-b border-border bg-void py-10 sm:py-14">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">Historical class explorer</span><h2 className="mt-2 font-headline text-3xl uppercase leading-none text-ink sm:text-4xl">What became of this board?</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">The model board above is the evaluation side. This layer closes the loop with the outcomes already recorded in the sheet.</p></div>
          <div className="grid grid-cols-3 divide-x divide-border border border-border bg-surface">
            <div className="px-4 py-3"><p className="font-headline text-2xl text-ink">{Math.round(modelHitRate)}%</p><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Hit rate</p></div>
            <div className="px-4 py-3"><p className="font-headline text-2xl text-ink">{hits.length}</p><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Hits</p></div>
            <div className="px-4 py-3"><p className="font-headline text-2xl text-ink">{misses.length}</p><p className="font-mono text-[8px] uppercase tracking-widest2 text-ink-tertiary">Misses</p></div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <div className="border border-border bg-surface"><div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Best model grades that hit</span><span className="text-[10px] text-ink-tertiary">Current format</span></div>{topHits.length ? topHits.map((p, i) => <Link key={p.id} href={playerHref(p.id, format)} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-raised"><span className="w-6 font-data text-[10px] text-ink-tertiary">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{p.name}</p><p className="mt-0.5 text-[10px] text-ink-tertiary">{p.position} · {p.finish ?? "Hit"}{p.adp !== undefined ? ` · NFL pick ${p.adp}` : ""}</p></div><span className="font-data text-sm text-accent">{scoreForProspect(p, format)?.toFixed(1) ?? "—"}</span></Link>) : <div className="p-4 text-sm text-ink-tertiary">No resolved hits are recorded for this class yet.</div>}</div>
          <div className="border border-border bg-surface p-4"><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Where the board missed</p>{topMisses.length ? <div className="mt-3 space-y-3">{topMisses.map((p) => <Link key={p.id} href={playerHref(p.id, format)} className="block border-l-2 border-faller/60 pl-3"><p className="text-sm font-semibold text-ink">{p.name}</p><p className="mt-0.5 text-xs text-ink-tertiary">DD {scoreForProspect(p, format)?.toFixed(1) ?? "—"} · {p.finish ?? "Miss"}</p></Link>)}</div> : <p className="mt-3 text-sm text-ink-tertiary">No resolved misses are recorded for this class.</p>}{avgAdp !== undefined && <div className="mt-5 border-t border-border pt-4"><p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Average NFL draft slot</p><p className="mt-1 font-headline text-3xl text-ink">#{avgAdp.toFixed(0)}</p></div>}</div>
        </div>
      </Container>
    </section>
  );
}

export function ClassYearContent({
  prospects,
  allProspects,
  earlyWatchMode = false,
}: {
  /** Just this class's prospects, for the rankings table and the class-scoped half of the summary. */
  prospects: Prospect[];
  /** The full database, only needed for the "vs. database average" comparison. */
  allProspects: Prospect[];
  /** Future-class presentation mode; optional so existing consumers remain compatible. */
  earlyWatchMode?: boolean;
}) {
  // Mirrors RankingsTable's own format state via onFormatChange —
  // this component doesn't try to independently guess the format
  // (URL params, back-navigation, sticky preference); it just stays
  // in sync with whatever the table below actually resolves to.
  // Kept as part of the component contract because the page determines whether
  // this class is an early-watch class. The rankings and summary still derive
  // their actual data live from the prospect dataset.
  void earlyWatchMode;
  const [format, setFormat] = useState<LeagueFormat>("SUPERFLEX");
  const [tierDistributionExpanded, setTierDistributionExpanded] = useState(false);
  const handleFormatChange = useCallback((next: LeagueFormat) => setFormat(next), []);

  const summary = useMemo(
    () => computeClassSummary(prospects, allProspects, format),
    [prospects, allProspects, format]
  );
  const topTier = summary.topProspect
    ? summary.isPreDraftClass
      ? preDraftTierForComparison(summary.topProspect, format)
      : tierForProspect(summary.topProspect, format)
    : undefined;

  return (
    <>
      {summary.resolvedCount > 0 && (
        <section className="border-b border-border bg-surface">
          <Container className="py-6 sm:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
              <div className="lg:w-72 lg:shrink-0">
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
                  {summary.isPreDraftClass ? "Pre-Draft Class Strength" : "Class Strength"}
                </span>
                {summary.isPreDraftClass && summary.strength && (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-headline text-3xl uppercase leading-none text-ink">{summary.strength}</span>
                    {summary.percentile !== undefined && (
                      <span className="font-mono text-[10px] uppercase tracking-widest2 text-accent">
                        {ordinal(Math.max(1, Math.round(summary.percentile)))} percentile
                      </span>
                    )}
                  </div>
                )}
                {summary.classEliteRate !== undefined && summary.benchmark.rate !== undefined && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                    <span className="font-headline text-3xl text-ink">{summary.classEliteRate.toFixed(0)}%</span>{" "}
                    Elite+, {summary.classEliteRate >= summary.benchmark.rate ? "above" : "below"} the{ " "}
                    {summary.benchmark.rate.toFixed(0)}% {summary.isPreDraftClass ? "historical drafted rookie average" : "database average"}.
                  </p>
                )}
                {summary.isPreDraftClass && summary.benchmark.classesCompared > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">
                    Normalized to a typical historical class size to account for prospects who may eventually fall out of the class.
                  </p>
                )}
                <div className="mt-5 grid gap-3 border-t border-border pt-4 text-xs">
                  {summary.topProspect && topTier && (
                    <p className="leading-relaxed text-ink-tertiary">
                      <span className="font-mono text-[9px] uppercase tracking-widest2">Highest graded</span><br />
                      <Link href={playerHref(summary.topProspect.id, format)} className="font-semibold text-ink hover:text-accent">
                        {summary.topProspect.name}
                      </Link>{" "}
                      <span style={{ color: getTierColor(topTier) }}>({topTier})</span>
                    </p>
                  )}
                  {summary.strongestPosition && (
                    <p className="leading-relaxed text-ink-tertiary">
                      <span className="font-mono text-[9px] uppercase tracking-widest2">Strongest position</span><br />
                      <span className="font-semibold text-ink">{summary.strongestPosition}</span> by average class score
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1">
                {(() => {
                  const activeTiers = TIER_DEFINITIONS.filter((t) => (summary.tierCounts[t.name] ?? 0) > 0);
                  const maxCount = Math.max(1, ...activeTiers.map((t) => summary.tierCounts[t.name] ?? 0));
                  const row = (tier: (typeof TIER_DEFINITIONS)[number]) => {
                    const count = summary.tierCounts[tier.name] ?? 0;
                    const widthPct = (count / maxCount) * 100;
                    return (
                      <div key={tier.name} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-tertiary sm:w-32">{tier.name}</span>
                        <div className="h-2 flex-1 bg-border-strong/40"><div className="h-full transition-[width] duration-300" style={{ width: `${widthPct}%`, backgroundColor: tier.color }} /></div>
                        <span className="w-5 shrink-0 text-right font-data text-[11px] font-semibold text-ink">{count}</span>
                      </div>
                    );
                  };
                  return (
                    <>
                      <div className="hidden lg:block">
                        <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">Tier Distribution</span>
                        <div className="mt-3 flex flex-col gap-2">{activeTiers.map(row)}</div>
                      </div>
                      <div className="lg:hidden">
                        <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">Tier Distribution</span>
                        <div className="mt-3 flex flex-col gap-2">{activeTiers.slice(0, 3).map(row)}</div>
                        {activeTiers.length > 3 && !tierDistributionExpanded && (
                          <button
                            type="button"
                            onClick={() => setTierDistributionExpanded(true)}
                            className="mt-3 font-mono text-[9px] uppercase tracking-widest2 text-accent transition-opacity hover:opacity-70"
                            aria-expanded={false}
                          >
                            View full distribution ↓
                          </button>
                        )}
                        {activeTiers.length > 3 && tierDistributionExpanded && (
                          <>
                            <div className="mt-3 flex flex-col gap-2">{activeTiers.slice(3).map(row)}</div>
                            <button
                              type="button"
                              onClick={() => setTierDistributionExpanded(false)}
                              className="mt-4 font-mono text-[9px] uppercase tracking-widest2 text-accent transition-opacity hover:opacity-70"
                              aria-expanded={true}
                            >
                              Show less ↑
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </Container>
        </section>
      )}

      <section className="bg-void py-8 sm:py-10">
        <Container>
          <RankingsTable
            prospects={prospects}
            showBigBoardDividers
            rankScope="collection"
            onFormatChange={handleFormatChange}
            earlyWatchMode={earlyWatchMode}
          />
        </Container>
      </section>

      <HistoricalClassExplorer prospects={prospects} format={format} />
    </>
  );
}
