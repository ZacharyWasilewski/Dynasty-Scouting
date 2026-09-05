"use client";

import { playerHref } from "@/lib/playerLinks";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { useEffect, useState } from "react";
import { GLOBAL_FORMAT_EVENT, getGlobalFormat } from "@/lib/globalFormat";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { SearchBar } from "@/components/home/SearchBar";
import type { Position, Prospect } from "@/types/prospect";

const FEATURED_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

/**
 * Real, third attempt at this hero's right-side visual. Two earlier
 * versions each solved one problem and created another: a single
 * score panel didn't establish what the number meant; a tier ladder
 * didn't demonstrate the headline's actual claim (a single
 * continuous score, not 8 category names). This version — the top
 * prospect at each of the 4 tracked positions, plotted on one shared
 * 0–100 line — directly proves "every prospect, one score." But it
 * shipped with a real bug: the fallback to Pre-Draft Score for
 * undrafted prospects meant an undrafted player with no actual DD
 * Score could show up under a "DYNASTY DATABASE SCORE" label that
 * wasn't true for them — Pre-Draft Score and DD Score are two
 * different things, and labeling both the same way here was
 * genuinely misleading, not just an edge case. Restricted to
 * drafted, DD-Score-only prospects now, so every number under that
 * label actually is one.
 */
function topByPosition(prospects: Prospect[], format: LeagueFormat): { prospect: Prospect; score: number }[] {
  const scored = prospects
    .filter((p) => p.hasDraftData === true)
    .map((p) => ({ prospect: p, score: getDDScore(p, format) }))
    .filter((x): x is { prospect: Prospect; score: number } => x.score !== undefined);

  return FEATURED_POSITIONS.map((pos) => {
    const atPosition = scored.filter((x) => x.prospect.position === pos);
    return atPosition.length > 0 ? atPosition.sort((a, b) => b.score - a.score)[0] : undefined;
  })
    .filter((x): x is { prospect: Prospect; score: number } => x !== undefined)
    .sort((a, b) => b.score - a.score);
}

export function Hero({ prospects, activeClassYear }: { prospects: Prospect[]; activeClassYear?: string }) {
  const [format, setFormat] = useState<LeagueFormat>("SUPERFLEX");
  useEffect(() => {
    const sync = () => setFormat(getGlobalFormat());
    sync();
    window.addEventListener(GLOBAL_FORMAT_EVENT, sync);
    return () => window.removeEventListener(GLOBAL_FORMAT_EVENT, sync);
  }, []);

  const featured = topByPosition(prospects, format);
  const featuredTop = featured.length > 0 ? featured[0] : undefined;
  const topScore = featuredTop ? Math.round(featuredTop.score) : undefined;

  // Positions are based on real score, but with only ~340px of
  // height and up to 4 labels, two positions with genuinely close
  // scores (say 88 and 89) would land close enough to visually
  // overlap. A 22% minimum gap also does double duty here: since
  // these 4 prospects are each their own position's best-ever
  // drafted score, they naturally cluster in the 80-100 range,
  // which — positioned by raw score alone — left most of the
  // container's height empty below them. A larger enforced gap
  // spreads the 4 items across most of the available height instead
  // of leaving that space blank, while still preserving their real
  // relative order and approximate position on the scale.
  const MIN_GAP_PCT = 24;
  let previousPct: number | undefined;
  const placedFeatured = featured.map((item) => {
    let pct = 100 - item.score;
    if (previousPct !== undefined && pct - previousPct < MIN_GAP_PCT) {
      pct = previousPct + MIN_GAP_PCT;
    }
    // Defensive clamp — the 4 featured prospects are each their own
    // position's highest score, so in practice this never
    // approaches the container's edge, but an unlikely case (all 4
    // positional leaders clustered at very low scores) could push
    // the cumulative minimum-gap adjustment past 100%.
    pct = Math.min(pct, 90);
    previousPct = pct;
    return { ...item, topPct: pct };
  });

  return (
    <section className="relative overflow-hidden border-b border-border bg-void bg-rule-lines">
      {/* Mobile's own version of the data-as-imagery moment — not
          the full scale visual (there's no room to put that beside
          the headline at phone width without cramping both), just a
          big ghost numeral sitting behind the text as texture.
          Purely decorative and behind the content (pointer-events-
          none, negative z-index), so there's no risk of it
          interfering with the actual, interactive hero content in
          front of it. */}
      {topScore !== undefined && (
        <div
          className="pointer-events-none absolute -right-16 -top-10 select-none font-headline text-[220px] leading-none text-ink opacity-[0.04] lg:hidden"
        >
          {topScore}
        </div>
      )}
      <Container className="relative grid grid-cols-1 gap-10 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12 lg:py-20 xl:gap-20 xl:py-24">
        <div className="animate-fade-in-up [animation-delay:0ms]">
          <Badge tone="outline" className="animate-fade-in-up [animation-delay:0ms]">
            {activeClassYear ? `${activeClassYear} Draft Cycle · In Progress` : "Live Prospect Database"}
          </Badge>

          <h1 className="mt-4 animate-fade-in-up font-headline text-4xl uppercase leading-[0.9] tracking-tight text-ink [animation-delay:120ms] sm:text-6xl lg:text-7xl xl:text-8xl">
            <span className="whitespace-nowrap">Every Prospect.</span>
            <br />
            <span className="text-accent">One Score.</span>
          </h1>

          <p className="mt-6 max-w-md animate-fade-in-up text-lg leading-relaxed text-ink-secondary [animation-delay:200ms]">
            Any position. Any draft class since 2015. Dynasty Database assigns every dynasty-relevant prospect a
            score from 0–100, putting every player on the same scale to help you build the best dynasty roster.
          </p>

          <div className="mt-8 max-w-xl animate-fade-in-up [animation-delay:260ms]">
            <SearchBar />
            {/* Search remains the primary action, but the two most common
                next steps should not require someone to infer that they need
                to scroll. These stay compact on phones rather than adding a
                third large promotional block to the homepage. */}
            <div className="mt-3 grid gap-2 sm:flex">
              <Link
                href={activeClassYear ? `/classes/${activeClassYear}` : "/players"}
                prefetch={false}
                className="flex min-h-11 items-center justify-center border border-accent bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dim sm:flex-1"
              >
                {activeClassYear ? `Browse ${activeClassYear} rankings` : "Browse rankings"}
              </Link>
              <Link
                href="/mock-draft"
                prefetch={false}
                className="flex min-h-11 items-center justify-center border border-border-strong bg-surface px-4 text-sm font-semibold text-ink-secondary transition-colors hover:border-accent/50 hover:text-ink sm:flex-1"
              >
                Start a mock draft
              </Link>
            </div>
          </div>
        </div>

        {/* THE SCALE — hidden below lg rather than shrunk, since at
            phone width this composition doesn't work as a side-by-
            side; mobile gets the ghost-numeral texture above
            instead, not a squeezed version of this. */}
        {featured.length > 0 && (
          <div className="relative hidden h-full min-h-[390px] flex-col pl-8 lg:flex xl:pl-12">
            <div className="flex items-center justify-between pb-3 font-mono text-[10px] text-ink-tertiary">
              <span>100</span>
              <span className="uppercase tracking-widest2">Dynasty Database Score</span>
              <span>0</span>
            </div>
            <div className="relative mt-5 flex-1 border-l border-border-strong">
              {placedFeatured.map((item) => {
                return (
                  <Link
                    key={item.prospect.id}
                    href={playerHref(item.prospect.id, format)}
                    prefetch={false}
                    className="group absolute left-0 flex w-full -translate-y-1/2 items-center"
                    style={{ top: `${item.topPct}%` }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full border-2 border-void bg-accent transition-transform duration-150 group-hover:scale-125" />
                    <span className="ml-5 flex min-w-0 flex-1 items-center gap-4 border-b border-border/50 pb-2 transition-colors duration-150 group-hover:border-accent/40">
                      {/* A small portrait makes the scale feel like a live
                          player database instead of anonymous numbers, while
                          the score—not the image—still owns the visual
                          hierarchy. This desktop-only scale is hidden on
                          phones, where the same portraits would crowd the
                          hero's primary message. */}
                      <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface">
                        {item.prospect.photoUrl ? (
                          <Image
                            src={item.prospect.photoUrl}
                            alt=""
                            width={48}
                            height={48}
                            unoptimized
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-mono text-[9px] font-semibold text-ink-tertiary">
                            {item.prospect.position}
                          </span>
                        )}
                      </span>
                      <span className="font-headline text-3xl leading-none text-ink transition-colors group-hover:text-accent xl:text-4xl">
                        {item.score.toFixed(1)}
                      </span>
                      <span className="font-mono text-xs text-ink-tertiary transition-colors group-hover:text-ink-secondary xl:text-sm">
                        {item.prospect.name} · {item.prospect.position}
                        {item.prospect.school ? ` · ${item.prospect.school}` : ""}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
