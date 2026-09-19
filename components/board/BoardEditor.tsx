"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatFromParam, FORMAT_QUERY_PARAM, playerHref } from "@/lib/playerLinks";
import { useSearchParams, useRouter } from "next/navigation";
import { type LeagueFormat } from "@/lib/ddScore";
import { boardStorageKey, saveBoard } from "@/lib/boardSave";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronUp, ChevronDown, ChevronRight, RotateCcw, LogIn, Share2, Check, Copy } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { getScoreForFormat, getTierForFormat } from "@/lib/mockDraft";
import { getTierColor, getTierForScore, getOpportunityColor } from "@/lib/tiers";
import { OPPORTUNITY_OPTIONS_BY_POSITION, normalizeOpportunityLabel } from "@/lib/opportunityScales";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import type { Prospect } from "@/types/prospect";

export function BoardEditor({ prospects, classYear }: { prospects: Prospect[]; classYear: string }) {
  const { user, loading: authLoading } = useAuth();

  // Personal order stays fixed when the score format changes; reset uses that format.
  const searchParams = useSearchParams();
  const [format, setFormat] = useState<LeagueFormat>(() => formatFromParam(searchParams.get("format")));
  const router = useRouter();
  useEffect(() => { const params = new URLSearchParams(searchParams.toString()); params.set("format", FORMAT_QUERY_PARAM[format]); if (params.toString() !== searchParams.toString()) router.replace(`/board/${classYear}?${params}`, { scroll: false }); }, [classYear, format, router, searchParams]);
  const qb = format.startsWith("SUPERFLEX") ? "SUPERFLEX" : "1QB";
  const te = format.endsWith("TEP") ? "TEP" : "STANDARD";
  const defaultOrder = useMemo(() => [...prospects].sort((a,b) => (getScoreForFormat(b, qb, te) ?? -Infinity) - (getScoreForFormat(a, qb, te) ?? -Infinity)), [prospects, qb, te]);

  // Starts as the default DD order, not null — the page renders a
  // real, usable board immediately instead of an empty placeholder
  // while waiting on the saved-order fetch below. If a saved custom
  // order exists, it quietly swaps in once that fetch resolves;
  // someone with no saved board yet (the common case) never sees a
  // loading state at all.
  const [order, setOrder] = useState<Prospect[]>(defaultOrder);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [opportunityOverrides, setOpportunityOverrides] = useState<Record<string, string>>({});
  const [opportunityScales, setOpportunityScales] = useState<Record<string, Record<string, number>>>({});
  const [personalizedScores, setPersonalizedScores] = useState<Record<string, number>>({});
  const [opportunityError, setOpportunityError] = useState<Record<string, string>>({});
  const [savingOpportunityId, setSavingOpportunityId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Brief highlight on whichever row a move button just touched — a
  // lightweight "clearly show the new position" confirmation for the
  // arrow-reorder (rather than a toast on every single click, which
  // would fire constantly during a real reordering session and
  // become noise rather than feedback).
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const moveHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFlush = useRef<(() => void) | null>(null);
  useEffect(() => () => { latestFlush.current?.(); }, []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">("idle");
  const [boardReady, setBoardReady] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [previousOrder, setPreviousOrder] = useState<Prospect[] | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // router.refresh() can deliver a newer canonical snapshot without remounting
  // this client component. Reconcile by ID so custom order is preserved while
  // every displayed score/tier/photo object is replaced with the live version.
  useEffect(() => {
    setOrder((previous) => {
      const latestById = new Map(prospects.map((p) => [p.id, p]));
      const preserved = previous
        .map((p) => latestById.get(p.id))
        .filter((p): p is Prospect => !!p);
      const seen = new Set(preserved.map((p) => p.id));
      const added = defaultOrder.filter((p) => !seen.has(p.id));
      return [...preserved, ...added];
    });
  }, [prospects, defaultOrder]);

  async function handleShare() {
    setShareState("sharing");
    try {
      if (!user || !boardReady) throw new Error("Board not ready");
      await saveBoard(boardStorageKey(user.id, classYear), classYear, order.map(p => p.id));
      const res = await fetch("/api/shared/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classYear, prospectIds: order.map(p => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Share failed");
      const url = `${window.location.origin}/shared/board/${data.id}?format=${FORMAT_QUERY_PARAM[format]}`;
      setShareUrl(url);
      track("board_shared", `/board/${classYear}`);
      // Clipboard access can fail silently in some contexts (e.g. no
      // secure-context permission) — the visible link is still there
      // as a fallback either way, so a failed copy isn't worth an
      // error state, just skip straight past the "copied" confirmation.
      try {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      } catch {
        setShareState("idle");
      }
    } catch {
      setSaveState("error");
      setShareState("idle");
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setBoardReady(false);
    fetch(`/api/board/${classYear}`)
      .then((res) => { if (!res.ok) throw new Error("Load failed"); return res.json(); })
      .then((data: { prospectIds: string[] | null }) => {
        if (cancelled) return;
        let pending: string[] | null = null;
        try { const value = JSON.parse(localStorage.getItem(boardStorageKey(user.id, classYear)) ?? "null"); if (Array.isArray(value) && value.every(id => typeof id === "string")) pending = value; } catch {}
        if (pending) data.prospectIds = pending;
        skipNextSave.current = !pending;
        setBoardReady(true);
        if (!data.prospectIds || data.prospectIds.length === 0) {
          setOrder(defaultOrder);
          return;
        }
        const byId = new Map(prospects.map((p) => [p.id, p]));
        const fromSaved = data.prospectIds
          .map((id) => byId.get(id))
          .filter((p): p is Prospect => !!p);
        const savedIds = new Set(fromSaved.map((p) => p.id));

        // Players added to the class since this board was last edited
        // are slotted in at their own DD rank rather than appended at
        // the end. Appending buried a newly added elite prospect at the
        // bottom of an existing board, which reads as "he's missing"
        // rather than "he's new" — and is exactly wrong for the player
        // most likely to matter. Each new player lands directly below
        // the highest-ranked player already on the board that DD ranks
        // above him, so the user's own ordering is fully preserved.
        const defaultIndex = new Map(defaultOrder.map((p, i) => [p.id, i]));
        const merged = [...fromSaved];
        const missing = defaultOrder.filter((p) => !savedIds.has(p.id));
        for (const player of missing) {
          const rank = defaultIndex.get(player.id) ?? Number.POSITIVE_INFINITY;
          // Last position held by someone DD ranks above this player.
          let insertAt = 0;
          for (let i = 0; i < merged.length; i++) {
            const existing = merged[i];
            if (!existing) continue;
            const existingRank = defaultIndex.get(existing.id) ?? Number.POSITIVE_INFINITY;
            if (existingRank < rank) insertAt = i + 1;
          }
          merged.splice(insertAt, 0, player);
        }
        setOrder(merged);
      })
      .catch(() => {
        if (cancelled) return;
        skipNextSave.current = true;
        setSaveState("error");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, classYear]);

  // Personal Opportunity calls, plus the multiplier table the UI needs
  // to know which options are actually backed by real model values.
  useEffect(() => {
    if (!user) {
      setOpportunityOverrides({});
      setOpportunityScales({});
      setPersonalizedScores({});
      return;
    }
    let cancelled = false;
    fetch(`/api/board/opportunity/${classYear}?format=${FORMAT_QUERY_PARAM[format]}`)
      .then((res) => { if (!res.ok) throw new Error("Could not load overrides"); return res.json(); })
      .then((data: { overrides?: Record<string, string>; scores?: Record<string, number>; scales?: Record<string, Record<string, number>> }) => {
        if (cancelled) return;
        setOpportunityOverrides(data.overrides ?? {});
        setPersonalizedScores(data.scores ?? {});
        setOpportunityScales(data.scales ?? {});
      })
      .catch(() => { if (!cancelled) setSaveState("error"); });
    return () => { cancelled = true; };
  }, [user, classYear, format]);

  async function setOpportunityOverride(prospect: Prospect, opportunity: string | null) {
    if (!user) return;
    setSavingOpportunityId(prospect.id);
    setOpportunityError((prev) => {
      const next = { ...prev };
      delete next[prospect.id];
      return next;
    });
    try {
      if (opportunity === null) {
        const res = await fetch(
          `/api/board/opportunity/${classYear}?prospectId=${encodeURIComponent(prospect.id)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Unable to reset opportunity");
        setOpportunityOverrides((prev) => {
          const next = { ...prev };
          delete next[prospect.id];
          return next;
        });
        setPersonalizedScores((prev) => {
          const next = { ...prev };
          delete next[prospect.id];
          return next;
        });
        return;
      }
      const res = await fetch(`/api/board/opportunity/${classYear}?format=${FORMAT_QUERY_PARAM[format]}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, opportunity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOpportunityError((prev) => ({
          ...prev,
          [prospect.id]: typeof data.error === "string" ? data.error : "Unable to update opportunity.",
        }));
        return;
      }
      setOpportunityOverrides((prev) => ({ ...prev, [prospect.id]: opportunity }));
      if (typeof data.score === "number") {
        setPersonalizedScores((prev) => ({ ...prev, [prospect.id]: data.score }));
      }
    } catch {
      setOpportunityError(prev => ({ ...prev, [prospect.id]: "Could not save. Please try again." }));
    } finally {
      setSavingOpportunityId(null);
    }
  }

  // "Reset to DD order" means back to the model's own board entirely —
  // both the ordering and every personal Opportunity call, since an
  // override silently left behind would keep changing scores on a board
  // the user just asked to restore.
  async function resetToDefault() {
    if (user && !boardReady) return;
    if (!window.confirm("Reset this board and its opportunity overrides to the model defaults?")) return;
    if (user) {
      try {
        const res = await fetch(`/api/board/opportunity/${classYear}?all=1`, { method: "DELETE" });
        if (!res.ok) throw new Error("Reset failed");
      } catch { setSaveState("error"); return; }
    }
    setPreviousOrder(order);
    setOrder(defaultOrder);
    setOpportunityError({});
    setOpportunityOverrides({});
    setPersonalizedScores({});
  }

  useEffect(() => {
    if (!user || !boardReady) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const key = boardStorageKey(user.id, classYear);
    const ids = order.map(p => p.id);
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
    setSaveState("saving");
    let sent = false;
    const flush = () => {
      if (sent) return;
      sent = true;
      void saveBoard(key, classYear, ids).then(() => { if (latestFlush.current === flush) setSaveState("saved"); }).catch(() => { if (latestFlush.current === flush) setSaveState("error"); });
    };
    latestFlush.current = flush;
    const timer = setTimeout(flush, 800);
    window.addEventListener("pagehide", flush);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", flush); };
  }, [order, user, classYear, boardReady]);

  function move(index: number, direction: -1 | 1) {
    setPreviousOrder(order);
    setOrder((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index]!;
      next[index] = next[target]!;
      next[target] = temp;

      if (moveHighlightTimer.current) clearTimeout(moveHighlightTimer.current);
      setRecentlyMovedId(temp.id);
      moveHighlightTimer.current = setTimeout(() => setRecentlyMovedId(null), 500);

      return next;
    });
  }

  return (
    <main className="py-10">
      <Container className="max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-headline text-sm uppercase text-accent">My Big Board</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{classYear} Class</h1>
          </div>
          {user && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleShare}
                disabled={shareState === "sharing" || order.length === 0}
                className="flex items-center gap-1.5 border border-border-strong px-3 py-2 text-xs text-ink-secondary transition-colors duration-150 hover:text-ink disabled:opacity-50"
              >
                {shareState === "copied" ? (
                  <Check className="h-3.5 w-3.5 text-riser" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {shareState === "copied" ? "Link copied" : shareState === "sharing" ? "Sharing…" : "Share"}
              </button>
              <button
                onClick={resetToDefault}
                className="flex items-center gap-1.5 border border-border-strong px-3 py-2 text-xs text-ink-secondary transition-colors duration-150 hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to DD order
              </button>
            </div>
          )}
        </div>

        {shareUrl && (
          <div className="mt-3 flex items-center gap-2 border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{shareUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).catch(() => {});
                setShareState("copied");
                setTimeout(() => setShareState("idle"), 2000);
              }}
              className="shrink-0 text-accent hover:underline"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {authLoading ? (
          <div className="mt-8 h-24" />
        ) : !user ? (
          <EmptyState
            icon={LogIn}
            title="Log in to build your board."
            action={{ label: "Log in", href: `/login?redirect=${encodeURIComponent(`/board/${classYear}`)}` }}
            className="mt-8"
          />
        ) : (
          <>
            <p className="mt-2 h-4 font-mono text-[10px] text-ink-tertiary">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Big Board saved"}
              {saveState === "error" && <span role="alert">Could not load or save your board. <button onClick={() => window.location.reload()} className="underline">Reload to retry</button></span>}
            </p>
            <fieldset disabled={!!user && !boardReady} className="mt-2 border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
                <input aria-label="Search board" placeholder="Find a player" value={boardSearch} onChange={e => setBoardSearch(e.target.value)} className="border border-border bg-surface p-2 text-base" />
                <select disabled={savingOpportunityId !== null} aria-label="Board score format" value={format} onChange={e => { setPersonalizedScores({}); setFormat(e.target.value as LeagueFormat); }} className="border border-border bg-surface p-2 text-sm">{Object.keys(FORMAT_QUERY_PARAM).map(value => <option key={value} value={value}>{value.replace("SUPERFLEX", "Superflex").replace("_TEP", " · TEP")}</option>)}</select>
                {previousOrder && <button onClick={() => { setOrder(previousOrder); setPreviousOrder(null); }}>Undo order change</button>}
              </div>
              {order.map((p, i) => {
                if (boardSearch && !`${p.name} ${p.position} ${p.school}`.toLowerCase().includes(boardSearch.toLowerCase())) return null;
                const officialScore = getScoreForFormat(p, qb, te);
                const score = opportunityOverrides[p.id] ? personalizedScores[p.id] : officialScore;
                const tier = personalizedScores[p.id] !== undefined ? getTierForScore(personalizedScores[p.id]) : getTierForFormat(p, qb, te);
                const isExpanded = expandedId === p.id;
                const officialOpportunity = p.subScores?.find((sub) => sub.label === "Opportunity")?.text;
                const expectedOptions =
                  OPPORTUNITY_OPTIONS_BY_POSITION[p.position as keyof typeof OPPORTUNITY_OPTIONS_BY_POSITION] ?? [];
                const positionScale = opportunityScales[p.position] ?? {};
                // Only offer options that have a real multiplier behind
                // them — never a label the model can't actually score.
                const options = expectedOptions.filter((option) => Number.isFinite(positionScale[option]));
                const canAdjust = !!officialOpportunity && officialOpportunity !== "\u2014" && options.length > 0;
                const activeOpportunity = opportunityOverrides[p.id] ?? officialOpportunity;
                const isOverridden = !!opportunityOverrides[p.id];
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "border-b border-border transition-colors duration-500 last:border-0",
                      recentlyMovedId === p.id && "bg-accent/10"
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <input key={`${p.id}:${i}`} type="number" min={1} max={order.length} defaultValue={i + 1} aria-label={`Move ${p.name} to rank`} onBlur={e => { const rank = Number(e.target.value); if (!Number.isInteger(rank) || rank < 1 || rank > order.length) { e.target.value = String(i + 1); return; } if (rank === i + 1) return; setPreviousOrder(order); setOrder(prev => { const next = [...prev]; const [player] = next.splice(i, 1); if (player) next.splice(rank - 1, 0, player); return next; }); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} className="w-12 shrink-0 border border-border bg-surface p-1 text-center font-data text-sm text-ink-tertiary" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={playerHref(p.id, format)}
                          prefetch={false}
                          className="block truncate text-sm font-semibold text-ink hover:text-accent hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-tertiary">
                          {p.position} · <SchoolLogo url={p.schoolLogoUrl} size={10} /> {p.school ?? "—"}
                          {tier && (
                            <>
                              {" · "}
                              <span style={{ color: getTierColor(tier) }}>{tier}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-sm font-semibold",
                          isOverridden ? "text-accent" : "text-ink-secondary"
                        )}
                        title={isOverridden && officialScore !== undefined
                          ? `Your opportunity call. Official: ${officialScore.toFixed(1)}`
                          : undefined}
                      >
                        {score !== undefined ? score.toFixed(1) : "TBD"}
                        {isOverridden ? "*" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Hide" : "Show"} sub-scores for ${p.name}`}
                        className="shrink-0 p-1.5 text-ink-tertiary transition-colors duration-150 hover:text-accent active:scale-90"
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isExpanded && "rotate-90 text-accent")} />
                      </button>
                      <div className="flex shrink-0 flex-col">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${p.name} up`}
                          className="p-1.5 text-ink-tertiary transition-colors duration-150 hover:text-accent active:scale-90 disabled:opacity-20 disabled:active:scale-100"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === order.length - 1}
                          aria-label={`Move ${p.name} down`}
                          className="p-1.5 text-ink-tertiary transition-colors duration-150 hover:text-accent active:scale-90 disabled:opacity-20 disabled:active:scale-100"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface-raised/40 px-3 py-3">
                        {p.subScores?.length ? (
                          <div className="grid grid-cols-4 gap-x-2 gap-y-3 justify-items-center sm:grid-cols-6">
                            {p.subScores.map((sub) => (
                              <div key={sub.label} className="w-[54px] shrink-0">
                                <ScoreRing
                                  label={sub.label}
                                  value={sub.value}
                                  text={sub.text}
                                  size={48}
                                  decimals={0}
                                  info={subScoreDescription(p.position, sub.label)}
                                  infoHref={`/methodology#${subScoreSlug(p.position, sub.label)}`}
                                  color={
                                    sub.isPending
                                      ? "var(--color-border-strong)"
                                      : sub.value === 100
                                      ? "#7C3AED"
                                      : sub.isElite
                                      ? getTierColor("Elite")
                                      : sub.value !== undefined
                                      ? getTierColor(getTierForScore(sub.value) ?? "Roster Clogger")
                                      : getOpportunityColor(p.position, sub.text)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-xs text-ink-tertiary">No sub-scores available for this player.</p>
                        )}

                        {canAdjust && (
                          <div className="mt-4 border-t border-border pt-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="font-headline text-sm uppercase text-ink-tertiary">
                                Your opportunity call
                              </span>
                              <span className="font-mono text-[10px] text-ink-tertiary">
                                Official: {officialOpportunity}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-ink-tertiary">
                              Opportunity is the one judgement call in the model. Pick the role you
                              actually expect and the score recalculates from it — on your board only.
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {options.map((option) => {
                                const isActive =
                                  normalizeOpportunityLabel(option) === normalizeOpportunityLabel(activeOpportunity);
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    disabled={savingOpportunityId !== null}
                                    onClick={() => setOpportunityOverride(p, option)}
                                    aria-pressed={isActive}
                                    className={cn(
                                      "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors duration-150 disabled:opacity-50",
                                      isActive
                                        ? "border-accent bg-accent/10 text-accent"
                                        : "border-border-strong text-ink-secondary hover:border-accent/50 hover:text-ink"
                                    )}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                              {isOverridden && (
                                <button
                                  type="button"
                                  disabled={savingOpportunityId !== null}
                                  onClick={() => setOpportunityOverride(p, null)}
                                  className="flex items-center gap-1 border border-border-strong px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary transition-colors duration-150 hover:text-ink disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Reset
                                </button>
                              )}
                            </div>
                            {opportunityError[p.id] && (
                              <p className="mt-2 text-[11px] text-faller">{opportunityError[p.id]}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          </>
        )}
      </Container>
    </main>
  );
}
