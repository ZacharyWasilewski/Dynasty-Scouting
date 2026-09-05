"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, History, Search } from "@/components/ui/SiteIcons";
import type { Prospect } from "@/types/prospect";
import { Container } from "@/components/layout/Container";
import { GLOBAL_FORMAT_EVENT, getGlobalFormat } from "@/lib/globalFormat";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { getDisplayedPreDraftScore } from "@/lib/prospects";

function scoreForFormat(p: Prospect, format: LeagueFormat): number | undefined {
  return p.hasDraftData === true ? getDDScore(p, format) : getDisplayedPreDraftScore(p, format);
}

/**
 * The research layer. It intentionally avoids repeating the draft-room tools:
 * this section is about seeing the live board and studying resolved history.
 */
export function ProductShowcase({ prospects }: { prospects: Prospect[] }) {
  const [format, setFormat] = useState<LeagueFormat>("SUPERFLEX");
  useEffect(() => {
    const sync = () => setFormat(getGlobalFormat());
    sync();
    window.addEventListener(GLOBAL_FORMAT_EVENT, sync);
    return () => window.removeEventListener(GLOBAL_FORMAT_EVENT, sync);
  }, []);

  const current = useMemo(
    () => prospects
      .map((p) => ({ prospect: p, score: scoreForFormat(p, format) }))
      .filter((entry): entry is { prospect: Prospect; score: number } => entry.score !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
    [prospects, format]
  );

  const historical = useMemo(
    () => prospects
      .filter((p) => p.hasDraftData === true && p.hitMiss && Number(p.draftClass ?? 0) >= 2015)
      .sort((a, b) => Number(a.draftClass ?? 0) - Number(b.draftClass ?? 0)),
    [prospects]
  );
  const oldest = historical[0];
  const newest = historical[historical.length - 1];

  return (
    <section className="border-b border-border bg-surface py-20 sm:py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-end">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Research layer</span>
            <h2 className="mt-3 font-headline text-4xl uppercase leading-[.95] tracking-tight text-ink sm:text-5xl">
              See the board.
              <br />
              Then study the proof.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-ink-secondary lg:pb-1">
            Start with the live class, then go backward through the same model and inspect how earlier prospects actually turned out.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Link href="/players" prefetch={false} className="group border border-border bg-void p-6 transition-colors hover:border-accent/50 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <Search className="h-5 w-5 text-accent" />
              <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Live board · {format.replace("_", " ")}</span>
            </div>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">Current class</span>
                <h3 className="mt-2 font-headline text-3xl uppercase text-ink sm:text-4xl">Top grades</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-accent">Open rankings <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {current.map(({ prospect: p, score }, i) => (
                <div key={p.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-4">
                  <span className="font-data text-xs text-ink-tertiary">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 truncate text-base font-medium text-ink">{p.name}</span>
                  <span className="font-data text-sm text-accent">{score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </Link>

          <Link href="/classes" prefetch={false} className="group flex min-h-[360px] flex-col border border-border bg-void p-6 transition-colors hover:border-accent/50 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <History className="h-5 w-5 text-accent" />
              <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Historical lab</span>
            </div>
            <div className="mt-auto pt-12">
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">Resolved outcomes</span>
              <h3 className="mt-2 font-headline text-3xl uppercase leading-tight text-ink sm:text-4xl">Revisit the board</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
                Go back through past classes and inspect the same grades alongside the outcomes now recorded in the database.
              </p>
              <div className="mt-6 border-y border-border py-3 text-xs text-ink-tertiary">
                {oldest && newest ? `${oldest.draftClass}–${newest.draftClass} resolved history available` : "Historical outcomes build as the dataset does"}
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs text-accent">Explore classes <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-ink-tertiary"><BarChart3 className="h-3.5 w-3.5 text-accent" /> Every number above is generated from the current Dynasty Database dataset.</div>
      </Container>
    </section>
  );
}
