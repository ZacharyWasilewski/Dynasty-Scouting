"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Users, ArrowRight } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { PlayerPicker } from "@/components/comparison/PlayerPicker";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import { cn } from "@/lib/utils";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import type { LeagueFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";

export default function ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const preselectAId = searchParams.get("a");
  const preselectBId = searchParams.get("b");

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playerA, setPlayerA] = useState<Prospect | null>(null);
  const [playerB, setPlayerB] = useState<Prospect | null>(null);
  const snapshotVersionRef = useRef<number | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  // Real, reported problem: a QB's DD Score can jump from 82 in 1QB
  // to 95 in Superflex, but the comparison used to keep showing the
  // 1QB-based number regardless — inconsistent-looking, and not
  // actually the number the toggle elsewhere on the site says it
  // should be. Initialized from the same sticky cross-page
  // preference every other format toggle on the site uses, and
  // writes back to it on change, so this page stays consistent with
  // wherever the user came from or goes next.
  const [format, setFormatState] = useState<LeagueFormat>("SUPERFLEX");
  useEffect(() => {
    setFormatState(getGlobalFormat());
  }, []);
  function setFormat(next: LeagueFormat) {
    setFormatState(next);
    reportFormatUsed(next);
  }
  const isSuperflex = format === "SUPERFLEX" || format === "SUPERFLEX_TEP";
  const isTEP = format === "1QB_TEP" || format === "SUPERFLEX_TEP";

  // The comparison tool can stay mounted for a long time. Check the tiny
  // canonical version first; only fetch the full prospect dataset when the
  // snapshot actually changed. Focus + visibility can fire together, so the
  // in-flight promise also collapses duplicate lifecycle requests.
  useEffect(() => {
    let cancelled = false;
    async function loadProspects(force = false) {
      if (loadInFlightRef.current) return loadInFlightRef.current;
      const work = (async () => {
        try {
          if (prospects.length === 0) setLoading(true);
          const versionRes = await fetch("/api/data-version", { cache: "no-store" });
          const versionBody = await versionRes.json() as { version?: number | null };
          const nextVersion = typeof versionBody.version === "number" ? versionBody.version : null;
          if (!force && nextVersion !== null && snapshotVersionRef.current === nextVersion && prospects.length > 0) return;

          const res = await fetch("/api/prospects", { cache: "no-store" });
          const data: { prospects?: Prospect[]; version?: number; error?: string } = await res.json();
          if (cancelled) return;
          const nextProspects = data.prospects ?? [];
          setProspects(nextProspects);
          if (typeof data.version === "number") snapshotVersionRef.current = data.version;
          setPlayerA((prev) => prev ? nextProspects.find((p) => p.id === prev.id) ?? null : null);
          setPlayerB((prev) => prev ? nextProspects.find((p) => p.id === prev.id) ?? null : null);
          setLoadError(Boolean(data.error));
        } catch {
          if (!cancelled) setLoadError(true);
        } finally {
          if (!cancelled) setLoading(false);
          loadInFlightRef.current = null;
        }
      })();
      loadInFlightRef.current = work;
      return work;
    }
    void loadProspects(true);
    const onFocus = () => { void loadProspects(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadProspects();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Lifecycle checks intentionally own this request flow; state changes from
    // a completed load must not recursively trigger another fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lets a "Compare this player" link elsewhere on the site (e.g. a
  // player profile) land here with a player already picked, instead
  // of just dropping someone on an empty tool they have to
  // reconstruct their intent on. Only runs once prospects have
  // actually loaded, since that's what PlayerPicker needs to resolve
  // the id into a real Prospect. Reads both a and b so a link (or a
  // refreshed/reopened tab — see the sync effect below) can restore
  // a full matchup, not just one side of it.
  useEffect(() => {
    if (prospects.length === 0) return;
    if (preselectAId && !playerA) {
      const match = prospects.find((p) => p.id === preselectAId);
      if (match) setPlayerA(match);
    }
    if (preselectBId && !playerB) {
      const match = prospects.find((p) => p.id === preselectBId);
      if (match) setPlayerB(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectAId, preselectBId, prospects]);

  // Keeps the URL in sync with both selections — replace, not push,
  // so picking through a few different matchups doesn't fill up
  // browser history with one entry per click. This is what actually
  // makes a comparison survive a refresh or a "come back later":
  // without this, the two useState values above were the only place
  // a selection ever lived, gone the moment the tab closed.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (playerA) params.set("a", playerA.id);
    else params.delete("a");
    if (playerB) params.set("b", playerB.id);
    else params.delete("b");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerA, playerB]);

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
          <h1 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
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
              {!playerA && !playerB && (
                <div className="mb-6 border border-border bg-surface p-5 sm:p-6">
                  <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">Compare Prospects</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Select two or more players to compare DD Scores, tiers, underlying signals, historical context, and draft projections side by side.</p>
                  <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary"><ArrowRight className="h-3 w-3" /> Start with Player A below</p>
                </div>
              )}

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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-accent">
                      <Users className="h-4 w-4" strokeWidth={1.75} />
                      <span className="font-mono text-xs uppercase tracking-widest2">Comparison</span>
                    </div>
                    {/* League format toggle — controls which DD Score
                        both players are compared on. Same visual
                        pattern as the player profile's own toggle. */}
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-8 border border-border-strong bg-void p-0.5" role="group" aria-label="League format">
                        {(["1QB", "SUPERFLEX"] as const).map((value) => {
                          const active = isSuperflex === (value === "SUPERFLEX");
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setFormat(
                                  value === "SUPERFLEX"
                                    ? isTEP ? "SUPERFLEX_TEP" : "SUPERFLEX"
                                    : isTEP ? "1QB_TEP" : "1QB"
                                )
                              }
                              aria-pressed={active}
                              className={cn(
                                "h-full whitespace-nowrap px-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                                active ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                              )}
                            >
                              {value === "1QB" ? "1 QB" : "Superflex"}
                            </button>
                          );
                        })}
                      </div>
                      <div className="inline-flex h-8 border border-border-strong bg-void p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setFormat(isSuperflex ? (isTEP ? "SUPERFLEX" : "SUPERFLEX_TEP") : isTEP ? "1QB" : "1QB_TEP")
                          }
                          aria-pressed={isTEP}
                          className={cn(
                            "h-full whitespace-nowrap px-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest2 transition-colors duration-150",
                            isTEP ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                          )}
                        >
                          TEP
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ComparisonPanel current={playerA} other={playerB} format={format} />
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
