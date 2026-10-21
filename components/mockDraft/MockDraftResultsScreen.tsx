"use client";

import { tierHistoryLabel } from "@/lib/scoreStage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, LayoutGrid, RotateCcw, Share2, Trophy, Users, Zap } from "@/components/ui/SiteIcons";
import type { Prospect } from "@/types/prospect";
import { type MockPick, type MockSettings, formatPick, getScoreForFormat, getTierForFormat } from "@/lib/mockDraft";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { useAuth } from "@/components/auth/AuthProvider";
import { gradeTone, engineLabel } from "@/lib/mockDraftFormat";

/**
 * The post-draft results/grading screen, plus its two small stat-card
 * helpers. Extracted from MockDraftExperience.tsx (which was 2,200+
 * lines) — this was already fully self-contained: every value it
 * needs comes in as a prop, and its own state (save/share status) is
 * entirely local to itself, so nothing about the extraction changes
 * how it behaves.
 */
export function ResultsScreen({ draftId, classYear, settings, picks, prospectById, gradeRows, overallGrade, ddValueCaptured, onReset, onViewBoard }: { draftId: string; classYear: string; settings: MockSettings; picks: MockPick[]; prospectById: Map<string, Prospect>; gradeRows: Array<{ pick: MockPick; player: Prospect; grade: string; valueGain: number; scoreGap: number; tierGap: number }>; overallGrade: string; ddValueCaptured: number; onReset: () => void; onViewBoard: () => void }) {
  const totalScore = gradeRows.reduce((sum, row) => sum + (getScoreForFormat(row.player, settings.qbFormat, settings.teFormat) ?? 0), 0);
  const bestPick = [...gradeRows].sort((a, b) => b.valueGain - a.valueGain)[0];

  // Saved automatically for logged-in users — a few hundred bytes per
  // draft (only ~4-5 picks are ever the user's own, one per round),
  // so there's no real storage cost to doing this by default rather
  // than asking someone to remember to click "save."
  const { user } = useAuth();
  const savedRef = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  const attemptSave = useCallback(() => {
    setSaveState("saving");
    fetch("/api/mock-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draftId,
        classYear,
        settings: { ...settings, fullBoard: picks.map(pick => {
          const player = prospectById.get(pick.playerId);
          return {
            ...pick,
            playerName: player?.name ?? pick.playerId,
            position: player?.position ?? "",
            score: player ? getScoreForFormat(player, settings.qbFormat, settings.teFormat) ?? null : null,
            tier: player ? getTierForFormat(player, settings.qbFormat, settings.teFormat) ?? null : null,
            photoUrl: player?.photoUrl,
            scoreLabel: player ? tierHistoryLabel(player, "mock") : "Score",
          };
        }) },
        overallGrade,
        picks: gradeRows.map((row) => ({
          overall: row.pick.overall,
          playerId: row.player.id,
          playerName: row.player.name,
          position: row.player.position,
          tier: getTierForFormat(row.player, settings.qbFormat, settings.teFormat) ?? null,
          ddScore: getScoreForFormat(row.player, settings.qbFormat, settings.teFormat) ?? null,
          grade: row.grade,
          valueGain: row.valueGain,
          scoreGap: row.scoreGap,
        })),
      }),
    })
      .then(async (res) => {
        setSaveState(res.ok ? "saved" : "error");
        if (res.ok) {
          track("mock_draft_completed", "/mock-draft");
          const data = await res.json().catch(() => null);
          if (data?.id) setSavedDraftId(data.id);
        }
      })
      .catch(() => setSaveState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, draftId, classYear, settings, picks, prospectById, overallGrade, gradeRows]);

  useEffect(() => {
    if (!user || savedRef.current || gradeRows.length === 0) return;
    savedRef.current = true;
    attemptSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return <section className="mx-auto max-w-4xl"><div className="mb-5 flex flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-0"><div><p className="font-headline text-sm uppercase text-accent">Draft complete</p><h2 className="mt-1 font-headline text-3xl uppercase leading-none text-ink">Your {classYear} Draft</h2>{user ? (
    <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-tertiary">
      {saveState === "saving" && "Saving to your account…"}
      {saveState === "saved" && <><Check className="h-3 w-3 text-riser" /> Saved to your account</>}
      {saveState === "error" && (
        <>
          Couldn&apos;t save this draft. {" "}
          <button onClick={attemptSave} className="text-accent hover:underline">
            retry
          </button>
        </>
      )}
    </p>
  ) : (
    <Link href={`/login?redirect=/mock-draft`} className="mt-1 inline-block font-mono text-[10px] text-accent hover:underline">
      Log in to save this draft to your account
    </Link>
  )}</div><div className="flex max-w-full flex-wrap items-center gap-2">{/* Share is genuinely absent (not just hidden) until the save
                    resolves, makes that gap visible instead of the
                    button just silently not being there, which is
                    easy to mistake for the feature not existing at
                    all if someone checks before the save finishes. */}
                {savedDraftId ? (
                  <button onClick={() => { track("mock_draft_shared", "/mock-draft"); navigator.clipboard.writeText(`${window.location.origin}/shared/mock-draft/${savedDraftId}`).then(() => { setShareState("copied"); setTimeout(() => setShareState("idle"), 2000); }).catch(() => {}); }} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink">{shareState === "copied" ? <Check className="h-3.5 w-3.5 text-riser" /> : <Share2 className="h-3.5 w-3.5" />} {shareState === "copied" ? "Link copied" : "Share"}</button>
                ) : user && saveState === "saving" ? (
                  <span className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-tertiary opacity-60"><Share2 className="h-3.5 w-3.5" /> Preparing share link…</span>
                ) : null}<button onClick={onViewBoard} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink"><LayoutGrid className="h-3.5 w-3.5" /> View draft board</button><button onClick={onReset} className="inline-flex items-center gap-2 border border-border-strong px-3 py-2 text-xs text-ink-secondary hover:text-ink"><RotateCcw className="h-3.5 w-3.5" /> New draft</button></div></div><div className="border border-border bg-surface p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] text-ink-tertiary">Overall draft grade</div><div className={cn("mt-1 font-headline text-7xl leading-none", gradeTone(overallGrade))}>{overallGrade}</div><p className="mt-1 text-sm text-ink-secondary">Based on DD value gained or lost versus the expected value of each draft slot.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><ResultStat label="DD Value Captured" value={`${ddValueCaptured.toFixed(1)}%`} /><ResultStat label="Total model score" value={totalScore.toFixed(1)} /><ResultStat label="Your Picks" value={String(gradeRows.length)} /></div></div></div><div className="mt-4 border border-border bg-surface"><div className="border-b border-border px-4 py-3"><p className="text-[10px] text-ink-tertiary">Your picks</p></div>{gradeRows.map((row) => <div key={row.pick.overall} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"><div className="w-12 shrink-0 font-data text-[10px] text-ink-tertiary">{formatPick(row.pick.overall, settings.teams)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{row.player.name}</p><p className="mt-0.5 text-[10px] text-ink-tertiary">{row.player.position} · {getTierForFormat(row.player, settings.qbFormat, settings.teFormat) ?? "TBD"} · {row.player.hasDraftData === true ? "DD" : "Pre-Draft"} {getScoreForFormat(row.player, settings.qbFormat, settings.teFormat)?.toFixed(1) ?? "TBD"}</p></div><div className={cn("font-data text-lg font-bold", gradeTone(row.grade))}>{row.grade}</div></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultCallout icon={<Trophy className="h-4 w-4" />} title="Best Pick" value={bestPick?.player.name ?? "—"} /><ResultCallout icon={<Zap className="h-4 w-4" />} title="Largest Value Miss" value={gradeRows.length ? `${Math.max(...gradeRows.map((r) => r.scoreGap)).toFixed(1)} DD points` : "—"} /><ResultCallout icon={<Users className="h-4 w-4" />} title="Engine" value={engineLabel(settings.engine)} /></div></section>;
}

function ResultStat({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface-raised p-3"><p className="text-[10px] text-ink-tertiary">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div>; }
function ResultCallout({ icon, title, value }: { icon: ReactNode; title: string; value: string }) { return <div className="border border-border bg-surface p-4"><div className="flex items-center gap-2 text-accent">{icon}<span className="text-[10px] text-ink-tertiary">{title}</span></div><p className="mt-2 truncate text-sm font-semibold text-ink">{value}</p></div>; }
