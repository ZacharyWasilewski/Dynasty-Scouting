"use client";

import { playerHref } from "@/lib/playerLinks";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Target, TrendingDown, TrendingUp } from "@/components/ui/SiteIcons";
import type { Prospect } from "@/types/prospect";
import { ddScoreForFormat, tierForFormat, leagueFormatFromSelection } from "@/lib/analytics";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";
import { getTierColor } from "@/lib/tiers";

function outcomeLabel(p: Prospect) {
  if (p.finish) return p.finish;
  if (p.hitMiss) return p.hitMiss === "HIT" ? "Hit" : "Miss";
  return "Outcome pending";
}

export function ModelValidationStory({ prospects }: { prospects: Prospect[] }) {
  const { selection } = useLeagueFormat();
  const resolved = prospects.filter((p) => p.hasDraftData === true && p.hitMiss);
  const scored = resolved
    .map((p) => ({ p, score: ddScoreForFormat(p, selection) }))
    .filter((x): x is { p: Prospect; score: number } => x.score !== undefined);

  const hits = scored.filter(({ p }) => p.hitMiss === "HIT");
  const misses = scored.filter(({ p }) => p.hitMiss === "MISS");
  const highHit = [...hits].sort((a, b) => b.score - a.score)[0];
  const highMiss = [...misses].sort((a, b) => b.score - a.score)[0];
  const lowHit = [...hits].sort((a, b) => a.score - b.score)[0];
  const topTier = scored.filter(({ p }) => {
    const tier = tierForFormat(p, selection);
    return tier === "Generational" || tier === "Elite";
  });
  const topTierHitRate = topTier.length ? (topTier.filter(({ p }) => p.hitMiss === "HIT").length / topTier.length) * 100 : undefined;

  const stories = [
    highHit && { eyebrow: "Model hit", player: highHit.p, score: highHit.score, tone: "positive" as const, copy: "A high-end grade that converted into a real hit." },
    highMiss && { eyebrow: "Model miss", player: highMiss.p, score: highMiss.score, tone: "negative" as const, copy: "The uncomfortable part of the track record: a premium grade that did not turn into a hit." },
    lowHit && { eyebrow: "Late surprise", player: lowHit.p, score: lowHit.score, tone: "neutral" as const, copy: "A hit from lower on the model board, showing where the system was not perfect." },
  ].filter(Boolean) as Array<{ eyebrow: string; player: Prospect; score: number; tone: "positive" | "negative" | "neutral"; copy: string }>;

  if (!scored.length) return null;

  return (
    <section className="border-y border-border bg-void py-14 sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Validation story</span>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">The good calls matter. The misses matter too.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">This is the model facing its own track record. There are no hand-picked success stories. The same live sheet data that powers the rankings determines the sample, the scores, and the outcomes shown here.</p>
            <div className="mt-6 grid grid-cols-2 gap-px border border-border bg-border">
              <div className="bg-surface p-4"><Target className="h-4 w-4 text-accent" /><p className="mt-3 font-headline text-3xl text-ink">{scored.length}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Resolved grades</p></div>
              <div className="bg-surface p-4"><ShieldCheck className="h-4 w-4 text-accent" /><p className="mt-3 font-headline text-3xl text-ink">{topTierHitRate === undefined ? "—" : `${Math.round(topTierHitRate)}%`}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Elite+ hit rate</p></div>
            </div>
            <Link href="#performance" className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest2 text-accent hover:underline">See the full backtest <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {stories.map(({ eyebrow, player, score, tone, copy }) => {
              const tier = tierForFormat(player, selection);
              const Icon = tone === "positive" ? TrendingUp : tone === "negative" ? TrendingDown : Target;
              return <Link key={`${eyebrow}-${player.id}`} href={playerHref(player.id, leagueFormatFromSelection(selection))} className="group border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-raised">
                <div className="flex items-center justify-between gap-3"><span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">{eyebrow}</span><Icon className={`h-4 w-4 ${tone === "negative" ? "text-faller" : tone === "positive" ? "text-riser" : "text-accent"}`} /></div>
                <p className="mt-5 font-headline text-2xl uppercase leading-none text-ink group-hover:text-accent">{player.name}</p>
                <p className="mt-2 text-xs text-ink-secondary">{player.position} · DD {score.toFixed(1)}</p>
                <p className="mt-4 text-xs leading-relaxed text-ink-tertiary">{copy}</p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-3"><span className="text-xs font-medium text-ink">{outcomeLabel(player)}</span>{tier && <span className="font-mono text-[9px] uppercase tracking-widest2" style={{ color: getTierColor(tier) }}>{tier}</span>}</div>
              </Link>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
