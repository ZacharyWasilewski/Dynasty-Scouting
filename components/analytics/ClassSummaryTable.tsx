"use client";

import { playerHref } from "@/lib/playerLinks";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Prospect } from "@/types/prospect";
import { computeDDScoreRoundHitRates, ddScoreForFormat, leagueFormatFromSelection } from "@/lib/analytics";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { isClassMature } from "@/lib/classMaturity";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

export interface ClassSummaryRow {
  year: string;
  count: number;
}

export function ClassSummaryTable({
  prospects,
  rows,
}: {
  prospects: Prospect[];
  rows: ClassSummaryRow[];
}) {
  const { mode } = useScoringMode();
  const weighted = mode === "weighted";
  const { selection } = useLeagueFormat();
  // Mobile-only — the desktop table below is already a compact,
  // scannable format, but on mobile this was rendering all 14 class
  // years stacked as cards unconditionally, meaningfully extending
  // an already-long page's very last section. Collapsed to the 6
  // most recent by default (rows is already newest-first — see
  // where it's built in app/analytics/page.tsx), with an explicit
  // toggle for anyone who actually wants the full historical list
  // rather than making everyone scroll past it by default.
  const MOBILE_COLLAPSED_COUNT = 6;
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // A class needs real NFL history before a 1st Round Hit Rate means
  // anything — same maturity rule as the Hit Rate by DD-Score Round
  // chart above, so an in-progress class (or one that hasn't had 3
  // years to develop) shows "—" instead of a premature number.
  const matureClassYears = useMemo(() => rows.map((r) => r.year).filter(isClassMature), [rows]);
  const round1 = useMemo(
    () => computeDDScoreRoundHitRates(prospects, matureClassYears, selection, 12, 1),
    [prospects, matureClassYears, selection]
  );

  const round1ByYear = useMemo(() => {
    const source = weighted ? round1.valueScore : round1.hitRate;
    return new Map(source.map((g) => [g.label, g.rounds[0] ?? null]));
  }, [round1, weighted]);

  const leagueFormat = leagueFormatFromSelection(selection);
  const topProspectByYear = useMemo(() => {
    const map = new Map<string, Prospect>();
    const grouped = new Map<string, Prospect[]>();
    for (const p of prospects) {
      if (!p.draftClass) continue;
      const group = grouped.get(p.draftClass) ?? [];
      group.push(p);
      grouped.set(p.draftClass, group);
    }
    for (const [year, group] of grouped) {
      // For an undrafted prospect, getDisplayedPreDraftScore returns
      // undefined until preDraftScore actually exists — which for the
      // very earliest devy class (2028), it usually doesn't yet, since
      // that requires mock-draft data that doesn't exist this early.
      // Without a fallback, every player in that class ties at the
      // same -Infinity, and the sort silently falls through to its
      // alphabetical tiebreaker for the entire class — a real,
      // reported bug (a name starting with "A" landing at the top of
      // 2028 looked like it was sorting alphabetically, because for
      // that class it effectively was). rawScore is what
      // ProfileHeader already falls back to for this same "too early
      // for a real pre-draft score" case; mirrored here rather than
      // changing the shared getDisplayedPreDraftScore function
      // itself, which 7 other components also depend on.
      const scoreFor = (p: Prospect): number | undefined => {
        if (p.hasDraftData === true) return ddScoreForFormat(p, selection);
        const preDraft = getDisplayedPreDraftScore(p, leagueFormat);
        // rawScore isn't format-adjusted the way getDisplayedPreDraftScore
        // already is internally — applying the same adjustment here,
        // matching ProfileHeader's exact pattern, so a QB and a WR
        // within the same 2028 fallback group are still compared on
        // equal footing rather than one being adjusted and the other not.
        return preDraft ?? applyFormatAdjustment(p.rawScore, p.position, leagueFormat);
      };
      const ranked = [...group].sort((a, b) => {
        const av = scoreFor(a);
        const bv = scoreFor(b);
        return (bv ?? -Infinity) - (av ?? -Infinity) || a.name.localeCompare(b.name);
      });
      if (ranked[0]) map.set(year, ranked[0]);
    }
    return map;
  }, [prospects, selection, leagueFormat]);

  return (
    <div>
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        1st round = top 12 by DD Score ·{" "}
        {weighted ? "Weighted Value Score" : "Standard Hit Rate"} ·{" "}
        {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TEP" : ""}
      </div>
      <div className="hidden overflow-x-auto border border-border sm:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-raised">
              <th className="border-b-2 border-border-strong px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                Class
              </th>
              <th className="border-b-2 border-border-strong px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                Top Prospect
              </th>
              <th className="border-b-2 border-border-strong px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                Prospects Graded
              </th>
              <th className="border-b-2 border-border-strong px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                1st Round {weighted ? "Value Score" : "Hit Rate"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const v = round1ByYear.get(c.year) ?? null;
              return (
                <tr key={c.year} className="border-t border-border transition-colors duration-150 hover:bg-surface-raised">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link href={`/classes/${c.year}`} prefetch={false} className="hover:text-accent hover:underline">
                      {c.year}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-ink-secondary">
                    {topProspectByYear.get(c.year) ? (
                      <Link href={playerHref(topProspectByYear.get(c.year)!.id, leagueFormat)} className="hover:text-accent hover:underline">
                        {topProspectByYear.get(c.year)!.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-ink-secondary">{c.count}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                    {v !== null ? `${v.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD LIST — below sm, replaces the table above entirely. */}
      <div className="border border-border sm:hidden">
        {(mobileExpanded ? rows : rows.slice(0, MOBILE_COLLAPSED_COUNT)).map((c) => {
          const v = round1ByYear.get(c.year) ?? null;
          return (
            <div key={c.year} className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0">
              <div className="min-w-0">
                <Link href={`/classes/${c.year}`} prefetch={false} className="inline-block font-medium text-ink hover:text-accent hover:underline active:opacity-60">
                  {c.year}
                </Link>
                <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                  {topProspectByYear.get(c.year) ? (
                    <Link href={playerHref(topProspectByYear.get(c.year)!.id, leagueFormat)} className="hover:text-accent hover:underline">
                      {topProspectByYear.get(c.year)!.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {" · "}
                  {c.count} graded
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold text-ink">
                {v !== null ? `${v.toFixed(0)}%` : "—"}
              </span>
            </div>
          );
        })}
        {rows.length > MOBILE_COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-widest2 text-accent active:bg-surface-raised"
          >
            {mobileExpanded ? "Show fewer" : `Show all ${rows.length} classes`}
          </button>
        )}
      </div>
    </div>
  );
}
