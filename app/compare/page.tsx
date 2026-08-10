"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PlayerPicker } from "@/components/comparison/PlayerPicker";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import type { Prospect } from "@/types/prospect";

export default function ComparePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playerA, setPlayerA] = useState<Prospect | null>(null);
  const [playerB, setPlayerB] = useState<Prospect | null>(null);

  useEffect(() => {
    fetch("/api/prospects")
      .then((res) => res.json())
      .then((data: { prospects?: Prospect[]; error?: string }) => {
        setProspects(data.prospects ?? []);
        setLoadError(Boolean(data.error));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  function handleSelectA(p: Prospect) {
    setPlayerA(p);
    if (playerB && p && playerB.position !== p.position) setPlayerB(null);
  }

  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col items-start py-20 lg:py-24">
          <span className="flex h-12 w-12 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="mt-6 font-mono text-xs uppercase tracking-widest2 text-accent">
            Player Comparison
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tightest text-ink sm:text-5xl">
            Compare any two prospects.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
            Pick two players at the same position to see how they stack up,
            score for score.
          </p>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          {loading ? (
            <p className="text-sm text-ink-tertiary">Loading prospects…</p>
          ) : loadError ? (
            <p className="text-sm text-ink-tertiary">
              Couldn&apos;t load prospects right now. Try again shortly.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <PlayerPicker
                  label="Player A"
                  prospects={prospects}
                  selected={playerA}
                  onSelect={handleSelectA}
                />
                <PlayerPicker
                  label="Player B"
                  prospects={prospects}
                  positionFilter={playerA?.position}
                  selected={playerB}
                  onSelect={setPlayerB}
                  disabled={!playerA}
                  disabledHint="Select Player A first"
                />
              </div>

              {playerA && playerB && (
                <div className="mx-auto mt-12 w-full max-w-lg border border-border-strong bg-surface p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-accent">
                    <Users className="h-4 w-4" strokeWidth={1.75} />
                    <span className="font-mono text-xs uppercase tracking-widest2">Comparison</span>
                  </div>
                  <div className="mt-4">
                    <ComparisonPanel current={playerA} other={playerB} />
                  </div>
                </div>
              )}
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
