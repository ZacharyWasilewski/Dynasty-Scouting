"use client";

import { useMemo } from "react";
import type { Prospect } from "@/types/prospect";
import { computeDDScoreRoundAverages } from "@/lib/analytics";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";
import { RoundBreakdownChart } from "@/components/analytics/RoundBreakdownChart";

/**
 * "Round" here means the model's own top-12-by-DD-Score group within a
 * class. This chart averages DD Score itself (not a real outcome), so
 * it's format-aware but intentionally not part of the Weighted/Standard
 * toggle — there's no outcome proportion here to reweight.
 */
export function DDScoreRoundValueChart({
  prospects,
  classYears,
}: {
  prospects: Prospect[];
  classYears: string[];
}) {
  const { selection } = useLeagueFormat();

  const data = useMemo(
    () => computeDDScoreRoundAverages(prospects, classYears, selection),
    [prospects, classYears, selection]
  );

  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        Average DD Score · {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TEP" : ""}
      </div>
      <RoundBreakdownChart data={data} emptyMessage="No classes have enough NFL history yet." />
    </div>
  );
}
