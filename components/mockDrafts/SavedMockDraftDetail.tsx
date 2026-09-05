"use client";

import { playerHref } from "@/lib/playerLinks";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommunityFormatLabel, formatPick, type MockQBFormat, type MockTEFormat } from "@/lib/mockDraft";
import { gradeTextColorClass } from "@/lib/utils";

function gradeTone(grade: string) {
  return gradeTextColorClass(grade);
}

interface SavedPick {
  overall: number;
  playerId: string;
  playerName: string;
  position: string;
  tier: string | null;
  ddScore: number | null;
  grade: string;
  valueGain: number;
  scoreGap: number;
}

interface SavedDraft {
  id: string;
  classYear: string;
  settings: { teams: number; qbFormat: MockQBFormat; teFormat: MockTEFormat };
  picks: SavedPick[];
  overallGrade: string | null;
  createdAt: string;
}

/** This saved draft's own format, converted to what player links need —
 *  a Superflex TEP mock draft's picks should open to their Superflex
 *  TEP score, not silently default to plain Superflex. */
function toLeagueFormat(qb: "1QB" | "SUPERFLEX", te: "STANDARD" | "TEP"): "1QB" | "1QB_TEP" | "SUPERFLEX" | "SUPERFLEX_TEP" {
  if (qb === "SUPERFLEX") return te === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX";
  return te === "TEP" ? "1QB_TEP" : "1QB";
}

export function SavedMockDraftDetail({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<SavedDraft | null | "not-found">(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/mock-drafts/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setDraft(data.draft))
      .catch(() => setDraft("not-found"));
  }, [user, id]);

  return (
    <main className="py-10">
      <Container className="max-w-2xl">
        <Link
          href="/mock-drafts"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-tertiary transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All mock drafts
        </Link>

        {authLoading ? (
          <div className="mt-8 h-24" />
        ) : !user ? (
          <EmptyState
            icon={LogIn}
            title="Log in to view this draft."
            action={{ label: "Log in", href: `/login?redirect=${encodeURIComponent(`/mock-drafts/${id}`)}` }}
            className="mt-8"
          />
        ) : draft === null ? (
          <div className="mt-8 h-24" />
        ) : draft === "not-found" ? (
          <p className="mt-8 text-sm text-ink-tertiary">
            That draft doesn&apos;t exist, or isn&apos;t yours.
          </p>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">
                  {new Date(draft.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-ink">{draft.classYear} Mock Draft</h1>
                <p className="mt-1 font-mono text-[11px] text-ink-tertiary">
                  {draft.settings.teams}-team · {getCommunityFormatLabel(draft.settings.qbFormat, draft.settings.teFormat)}
                </p>
              </div>
              {draft.overallGrade && (
                <div className={`text-6xl font-bold tracking-tight ${gradeTone(draft.overallGrade)}`}>
                  {draft.overallGrade}
                </div>
              )}
            </div>

            <div className="mt-6 border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Your picks</p>
              </div>
              {draft.picks.map((pick) => (
                <div key={pick.overall} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                  <div className="w-12 shrink-0 font-mono text-[10px] text-ink-tertiary">
                    {formatPick(pick.overall, draft.settings.teams)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={playerHref(pick.playerId, toLeagueFormat(draft.settings.qbFormat, draft.settings.teFormat))} className="truncate text-sm font-semibold text-ink hover:text-accent hover:underline">
                      {pick.playerName}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-ink-tertiary">
                      {pick.position} · {pick.tier ?? "TBD"} · DD {pick.ddScore?.toFixed(1) ?? "TBD"}
                    </p>
                  </div>
                  <div className={`font-data text-lg font-bold ${gradeTone(pick.grade)}`}>{pick.grade}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </main>
  );
}
