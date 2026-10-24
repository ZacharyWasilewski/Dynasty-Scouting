"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Users, ArrowRight } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { PlayerPicker } from "@/components/comparison/PlayerPicker";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import { FORMAT_QUERY_PARAM, formatFromParam } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { getGlobalFormat, reportFormatUsed, parseFormatParam } from "@/lib/globalFormat";
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
  const [restored, setRestored] = useState(false);
  const prospectCountRef = useRef(0);
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
  const [format, setFormatState] = useState<LeagueFormat>(() => formatFromParam(searchParams.get("format")));
  function setFormat(next: LeagueFormat) {
    setFormatState(next);
    reportFormatUsed(next);
  }
  // No explicit ?format= means: adopt the saved preference after mount.
  useEffect(() => {
    if (parseFormatParam(searchParams.get("format"))) return;
    setFormatState(getGlobalFormat());
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          if (prospectCountRef.current === 0) setLoading(true);
          const versionRes = await fetch("/api/data-version", { cache: "no-store" });
          const versionBody = await versionRes.json() as { version?: number | null };
          const nextVersion = typeof versionBody.version === "number" ? versionBody.version : null;
          if (!force && nextVersion !== null && snapshotVersionRef.current === nextVersion && prospectCountRef.current > 0) return;

          const res = await fetch("/api/prospects", { cache: "no-store" });
          const data: { prospects?: Prospect[]; version?: number; error?: string } = await res.json();
          if (cancelled) return;
          const nextProspects = data.prospects ?? [];
          if (!res.ok || data.error) throw new Error("Unable to load prospects");
          prospectCountRef.current = nextProspects.length;
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
    if (prospects.length === 0 || restored) return;
    const a = prospects.find(p => p.id === preselectAId) ?? null;
    const b = prospects.find(p => p.id === preselectBId) ?? null;
    setPlayerA(a);
    setPlayerB(a && b?.position === a.position ? b : null);
    setRestored(true);
  }, [prospects, preselectAId, preselectBId, restored]);

  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams(searchParams.toString());
    if (playerA) params.set("a", playerA.id); else params.delete("a");
    if (playerB) params.set("b", playerB.id); else params.delete("b");
    params.set("format", FORMAT_QUERY_PARAM[format]);
    if (params.toString() !== searchParams.toString()) router.replace(`${pathname}?${params}`, { scroll: false });
  }, [playerA, playerB, format, restored, pathname, router, searchParams]);

  const [clearedNotice, setClearedNotice] = useState("");
  function handleSelectA(p: Prospect | null) {
    setPlayerA(p);
    if (playerB && (!p || playerB.position !== p.position)) {
      // Player B can never stay selected across a position change.
      setClearedNotice(p ? `Player B was cleared because Player A is now a ${p.position}. Choose another ${p.position}.` : "");
      setPlayerB(null);
    } else {
      setClearedNotice("");
    }
  }

  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="py-4 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <h1 className="font-headline text-2xl uppercase leading-none tracking-tight text-ink sm:text-3xl">
              Compare two same-position prospects
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-secondary sm:text-sm">
            Pick Player A, then a Player B at the same position. Both are scored at a shared evaluation stage so the numbers are like-for-like.
          </p>
        </Container>
      </section>

      <section className="py-6 sm:py-8">
        <Container>
          {loading ? (
            <p className="text-sm text-ink-tertiary">Loading prospects…</p>
          ) : loadError ? (
            <p className="text-sm text-ink-tertiary">
              Couldn&apos;t load prospects right now. Try again shortly.
            </p>
          ) : (
            <>
              {clearedNotice && <p role="status" className="mb-3 border border-border bg-surface-raised px-3 py-2 text-xs text-ink-secondary">{clearedNotice}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
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
                  disabledHint="Select Player A first. Player B must play the same position."
                />
              </div>

              {playerA && playerB && (
                <div className="mx-auto mt-6 w-full max-w-lg border border-border-strong bg-surface p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-accent">
                      <Users className="h-4 w-4" strokeWidth={1.75} />
                      <span className="font-headline text-sm uppercase">Comparison</span>
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
