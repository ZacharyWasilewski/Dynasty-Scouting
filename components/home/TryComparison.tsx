"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Shuffle } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PlayerPicker } from "@/components/comparison/PlayerPicker";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import type { Prospect } from "@/types/prospect";

/**
 * The single highest-value addition from researching comparable
 * sites directly: KeepTradeCut's homepage lets a visitor use a real
 * piece of the actual product (rank 3 real players) before ever
 * making an account — that's the actual differentiator, not their
 * specific visual layout. This is the same underlying principle
 * applied to what this site's core product actually is: reuses the
 * real PlayerPicker/ComparisonPanel from /compare directly (not a
 * simplified mockup), pre-seeded with two real, historically
 * significant results so it's never empty on load.
 */
export function TryComparison({ prospects, defaultA, defaultB }: { prospects: Prospect[]; defaultA?: Prospect; defaultB?: Prospect }) {
  const [playerA, setPlayerA] = useState<Prospect | null>(defaultA ?? null);
  const [playerB, setPlayerB] = useState<Prospect | null>(defaultB ?? null);

  function randomize() {
    // Matches the established rule on the real /compare page — a
    // player's subscores are position-specific (the same label means
    // completely different underlying metrics for a QB vs a WR), so
    // a cross-position pairing isn't just unusual, it's not a valid
    // comparison at all. Picking a position first, then two real
    // players within it, guarantees every random matchup is
    // apples-to-apples.
    const byPosition = new Map<string, Prospect[]>();
    for (const p of prospects) {
      const list = byPosition.get(p.position) ?? [];
      list.push(p);
      byPosition.set(p.position, list);
    }
    const eligiblePositions = [...byPosition.entries()].filter(([, list]) => list.length >= 2);
    if (eligiblePositions.length === 0) return;
    const [, pool] = eligiblePositions[Math.floor(Math.random() * eligiblePositions.length)]!;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setPlayerA(shuffled[0] ?? null);
    setPlayerB(shuffled[1] ?? null);
  }

  return (
    <section className="theme-dark border-b border-border bg-void py-24">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Try It</span>
            <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
              Compare any two
              <br />
              players, right now.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              This is the real comparison tool, not a preview of it — pick any two prospects and see exactly how the
              model breaks them down.
            </p>
          </div>
          <Link
            href="/compare"
            className="group flex shrink-0 items-center gap-1.5 font-mono text-xs uppercase tracking-widest2 text-accent hover:underline"
          >
            Open the full tool
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 border border-border-strong bg-surface p-5 sm:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlayerPicker label="Player A" prospects={prospects} selected={playerA} onSelect={setPlayerA} />
            <PlayerPicker
              label="Player B"
              prospects={prospects}
              positionFilter={playerA?.position}
              selected={playerB}
              onSelect={setPlayerB}
              disabled={!playerA}
              disabledHint="Pick Player A first"
            />
          </div>

          {playerA && playerB ? (
            <div className="mt-8 border-t border-border pt-8">
              <ComparisonPanel current={playerA} other={playerB} />
            </div>
          ) : (
            <p className="mt-8 border-t border-border pt-8 text-center text-sm text-ink-tertiary">
              Pick two players above to compare them.
            </p>
          )}

          {prospects.length >= 2 && (
            <button
              onClick={randomize}
              className="mt-6 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary transition-colors duration-150 hover:text-accent"
            >
              <Shuffle className="h-3 w-3" /> Try a random matchup
            </button>
          )}
        </div>
      </Container>
    </section>
  );
}
