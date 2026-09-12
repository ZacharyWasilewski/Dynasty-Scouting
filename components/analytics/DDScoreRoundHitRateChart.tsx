"use client";

import { useMemo } from "react";
import type { Prospect } from "@/types/prospect";
import { computeDDScoreRoundHitRates } from "@/lib/analytics";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";
import { RoundBreakdownChart } from "@/components/analytics/RoundBreakdownChart";

/**
 * "Round" here means the model's own top-12-by-DD-Score group within a
 * class, not the real NFL round — see computeDDScoreRoundHitRates.
 */
export function DDScoreRoundHitRateChart({
  prospects,
  classYears,
}: {
  prospects: Prospect[];
  classYears: string[];
}) {
  const { mode } = useScoringMode();
  const weighted = mode === "weighted";
  const { selection } = useLeagueFormat();

  const { hitRate, valueScore } = useMemo(
    () => computeDDScoreRoundHitRates(prospects, classYears, selection),
    [prospects, classYears, selection]
  );

  const data = weighted ? valueScore : hitRate;

  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        {weighted ? "Showing Weighted Value Score (RP = 50)" : "Showing Standard Hit Rate"}
        {" · "}
        {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TEP" : ""}
      </div>
      <RoundBreakdownChart
        data={data}
        valueSuffix="%"
        emptyMessage="Trend data will appear once a class has had time to develop."
      />
    </div>
  );
}
