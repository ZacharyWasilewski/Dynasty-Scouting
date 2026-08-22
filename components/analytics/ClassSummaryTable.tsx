"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Prospect } from "@/types/prospect";
import { computeDDScoreRoundHitRates } from "@/lib/analytics";
import { isClassMature } from "@/lib/classMaturity";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

export interface ClassSummaryRow {
  year: string;
  count: number;
  topProspect?: Prospect;
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

  return (
    <div>
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        1st round = top 12 by DD Score ·{" "}
        {weighted ? "Weighted Value Score" : "Standard Hit Rate"} ·{" "}
        {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TE+" : ""}
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
                    <Link href={`/classes/${c.year}`} className="hover:text-accent hover:underline">
                      {c.year}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-ink-secondary">
                    {c.topProspect ? (
                      <Link href={`/players/${c.topProspect.id}`} prefetch={false} className="hover:text-accent hover:underline">
                        {c.topProspect.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-secondary">{c.count}</td>
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
        {rows.map((c) => {
          const v = round1ByYear.get(c.year) ?? null;
          return (
            <div key={c.year} className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0">
              <div className="min-w-0">
                <Link href={`/classes/${c.year}`} className="inline-block font-medium text-ink hover:text-accent hover:underline active:opacity-60">
                  {c.year}
                </Link>
                <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                  {c.topProspect ? (
                    <Link href={`/players/${c.topProspect.id}`} prefetch={false} className="hover:text-accent hover:underline">
                      {c.topProspect.name}
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
      </div>
    </div>
  );
}
