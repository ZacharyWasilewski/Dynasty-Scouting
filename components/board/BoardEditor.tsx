"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronRight, RotateCcw, LogIn, Share2, Check, Copy } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { getScoreForFormat, getTierForFormat } from "@/lib/mockDraft";
import { getTierColor, getTierForScore, getOpportunityColor } from "@/lib/tiers";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import type { Prospect } from "@/types/prospect";

export function BoardEditor({ prospects, classYear }: { prospects: Prospect[]; classYear: string }) {
  const { user, loading: authLoading } = useAuth();

  // `prospects` arrives already sorted by DD rank and capped to
  // BOARD_LIMIT (see app/board/[year]/page.tsx) — using it directly
  // instead of re-deriving the same order here avoids redundant work
  // (rebuilding a rank map and re-sorting up to 100 players) on every
  // load of this page, on top of the identical computation the
  // server component just did a moment earlier.
  const defaultOrder = prospects;

  // Starts as the default DD order, not null — the page renders a
  // real, usable board immediately instead of an empty placeholder
  // while waiting on the saved-order fetch below. If a saved custom
  // order exists, it quietly swaps in once that fetch resolves;
  // someone with no saved board yet (the common case) never sees a
  // loading state at all.
  const [order, setOrder] = useState<Prospect[]>(defaultOrder);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function handleShare() {
    setShareState("sharing");
    try {
      const res = await fetch("/api/shared/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classYear }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShareState("idle");
        return;
      }
      const url = `${window.location.origin}/shared/board/${data.id}`;
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
      setShareState("idle");
    }
  }

  useEffect(() => {
    if (!user) return;
    fetch(`/api/board/${classYear}`)
      .then((res) => res.json())
      .then((data: { prospectIds: string[] | null }) => {
        skipNextSave.current = true;
        if (!data.prospectIds || data.prospectIds.length === 0) {
          setOrder(defaultOrder);
          return;
        }
        const byId = new Map(prospects.map((p) => [p.id, p]));
        const fromSaved = data.prospectIds
          .map((id) => byId.get(id))
          .filter((p): p is Prospect => !!p);
        const savedIds = new Set(fromSaved.map((p) => p.id));
        // Anyone not in the saved order yet (added to the class since
        // this board was last edited) gets appended at the end, in
        // default rank order among themselves.
        const missing = defaultOrder.filter((p) => !savedIds.has(p.id));
        setOrder([...fromSaved, ...missing]);
      })
      .catch(() => {
        skipNextSave.current = true;
        setOrder(defaultOrder);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, classYear]);

  useEffect(() => {
    if (!order || !user) return;
    // The fetch above sets order too — don't immediately re-save the
    // exact data that was just loaded.
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      fetch(`/api/board/${classYear}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: order.map((p) => p.id) }),
      })
        .then((res) => setSaveState(res.ok ? "saved" : "idle"))
        .catch(() => setSaveState("idle"));
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  function move(index: number, direction: -1 | 1) {
    setOrder((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index]!;
      next[index] = next[target]!;
      next[target] = temp;
      return next;
    });
  }

  return (
    <main className="py-10">
      <Container className="max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">My Big Board</p>
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
                onClick={() => setOrder(defaultOrder)}
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
          <div className="mt-8 flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
            <LogIn className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink-secondary">Log in to build your board.</p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/board/${classYear}`)}`}
              className="mt-1 font-mono text-xs text-accent hover:underline"
            >
              Log in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 h-4 font-mono text-[10px] text-ink-tertiary">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Saved"}
            </p>
            <div className="mt-2 border border-border bg-surface">
              {order.map((p, i) => {
                const score = getScoreForFormat(p, "1QB", "STANDARD");
                const tier = getTierForFormat(p, "1QB", "STANDARD");
                const isExpanded = expandedId === p.id;
                return (
                  <div key={p.id} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-8 shrink-0 text-center font-mono text-sm text-ink-tertiary">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/players/${p.id}`}
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
                      <span className="shrink-0 font-mono text-sm font-semibold text-ink-secondary">
                        {score !== undefined ? score.toFixed(1) : "TBD"}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Container>
    </main>
  );
}
