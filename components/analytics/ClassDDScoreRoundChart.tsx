"use client";

import { useMemo } from "react";
import type { Prospect } from "@/types/prospect";
import type { BarDatum, LeagueFormatSelection } from "@/lib/analytics";
import { computeDDScoreRoundAverages } from "@/lib/analytics";
import { BarChart } from "@/components/analytics/BarChart";

/**
 * Single-class version of the Analytics page's "Average DD Score by
 * Round" chart. Same computeDDScoreRoundAverages function, just scoped
 * to one class year and rendered as a bar chart instead of a per-class
 * line chart. Format is a controlled prop — the parent page drives it
 * off the same QB/TEP switches already shown on the class's rankings
 * table, rather than a separate toggle set. "Round" means the model's
 * own top-12-by-DD-Score group within the class, not real NFL rounds.
 */
export function ClassDDScoreRoundChart({
  prospects,
  classYear,
  selection,
}: {
  prospects: Prospect[];
  classYear: string;
  selection: LeagueFormatSelection;
}) {
  const data: BarDatum[] = useMemo(() => {
    const [group] = computeDDScoreRoundAverages(prospects, [classYear], selection);
    const rounds = group?.rounds ?? [];
    return rounds.map((value, i) => ({
      label: `Round ${i + 1}`,
      value: value !== null ? Math.round(value * 10) / 10 : 0,
    }));
  }, [prospects, classYear, selection]);

  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        Average DD Score · {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TE+" : ""}
      </div>
      <BarChart data={data} emptyMessage="No DD Score data available for this class yet." />
    </div>
  );
}
