"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { PositionExplorer } from "@/components/positions/PositionExplorer";
import { ScoreRing } from "@/components/profile/ScoreRing";
import { computeHitRateByTier, selectionFromLeagueFormat } from "@/lib/analytics";
import { ALL_TIERS, getTierColor } from "@/lib/tiers";
import { wasRecentBackNavigation, getSavedFormatForPath, saveFormatForPath } from "@/lib/formatPersistence";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import type { LeagueFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";
import type { PositionTheme } from "@/lib/positionThemes";

/**
 * Owns the one shared 1QB/Superflex + TEP format state for this
 * page — both the hit-rate chart and the rankings table below it
 * read from it, so switching the format in the rankings table's own
 * toggle (there is no separate chart-only toggle) updates the chart
 * live too, the same way Analytics' charts all move together off one
 * shared format selection.
 */
export function PositionRankingsWithChart({
  prospects,
  theme,
  scoreDeltas,
}: {
  prospects: Prospect[];
  theme: PositionTheme;
  /** Prospect id -> score delta since the last settled Trending
   *  baseline (see lib/trending.ts). Plain object, not a Map — see
   *  the page component for why. */
  scoreDeltas: Record<string, number>;
}) {
  const pathname = usePathname();

  // A genuine browser Back/Forward back to this exact position page
  // restores whatever format was last active here; otherwise this
  // falls back to the user's sticky cross-page format preference
  // (lib/globalFormat) rather than always resetting to 1QB.
  const [initialFormat] = useState<LeagueFormat>(() => {
    if (wasRecentBackNavigation()) {
      const restored = getSavedFormatForPath(pathname);
      if (restored) return restored;
    }
    return getGlobalFormat();
  });
  const [qbFormat, setQbFormat] = useState<"1QB" | "SUPERFLEX">(
    initialFormat === "SUPERFLEX" || initialFormat === "SUPERFLEX_TEP" ? "SUPERFLEX" : "1QB"
  );
  const [tep, setTep] = useState(initialFormat === "1QB_TEP" || initialFormat === "SUPERFLEX_TEP");

  const format: LeagueFormat = tep
    ? (qbFormat === "SUPERFLEX" ? "SUPERFLEX_TEP" : "1QB_TEP")
    : qbFormat;

  useEffect(() => {
    saveFormatForPath(pathname, format);
    reportFormatUsed(format);
  }, [pathname, format]);

  const hitRateByTier = useMemo(
    () => computeHitRateByTier(prospects, ALL_TIERS, theme.code, selectionFromLeagueFormat(format)),
    [prospects, theme.code, format]
  );

  // One aggregate, headline-worthy number — real hits over real
  // resolved outcomes across the two highest tiers specifically
  // (not a blended "overall" hit rate, which would dilute a
  // meaningful claim with tiers nobody expects to hit anyway).
  const eliteAndAbove = hitRateByTier.filter((d) => d.tier === "Generational" || d.tier === "Elite");
  const eliteResolvedTotal = eliteAndAbove.reduce((sum, d) => sum + d.count, 0);
  const eliteHitsTotal = eliteAndAbove.reduce(
    (sum, d) => sum + (d.hitRate !== null ? Math.round((d.hitRate / 100) * d.count) : 0),
    0
  );
  const eliteHitRate = eliteResolvedTotal > 0 ? (eliteHitsTotal / eliteResolvedTotal) * 100 : undefined;

  return (
    <>
      {/* MODEL PERFORMANCE — one real number, one focal ring. Two
          earlier versions of this section were both, underneath
          their surface styling, the same structure as the Class
          page's tier breakdown: a list of 8 tier rows next to some
          proportional visual (bars, then a 10-square array). Genuinely
          different this time, not just re-skinned, a single ring
          (the same visual language already used for individual
          scores on player profiles, reused here rather than
          invented) stands in for the whole position's confidence
          level, with no per-tier list competing with it. Full
          tier-by-tier detail is still one tap away via the tier
          filter already built into the rankings below, rather than
          repeated as its own chart. */}
      <section className="border-b border-border bg-surface py-10">
        <Container className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
          {eliteHitRate !== undefined && (
            <ScoreRing
              label="Elite+ Hit Rate"
              value={eliteHitRate}
              decimals={0}
              suffix="%"
              size={128}
              color={getTierColor("Elite")}
              info={`Historical hit rate for ${theme.label.toLowerCase()} prospects graded Generational or Elite, the model's two highest tiers.`}
            />
          )}
          <p className="max-w-md text-center text-sm leading-relaxed text-ink-secondary sm:text-left">
            <span className="font-headline text-2xl text-ink">{prospects.length}</span>{" "}
            {theme.label.toLowerCase()} graded.
            {eliteHitRate !== undefined && (
              <>
                {" "}Prospects earning a Generational or Elite grade have hit{" "}
                <span className="font-semibold" style={{ color: theme.accent }}>
                  {eliteHitRate.toFixed(0)}% of the time
                </span>{" "}
                historically. Filter by tier in the rankings below for the full breakdown.
              </>
            )}
          </p>
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <SectionHeading eyebrow="Rankings" title={`All ${theme.label.toLowerCase()}`} />
          <div className="mt-8">
            <PositionExplorer
              prospects={prospects}
              theme={theme}
              qbFormat={qbFormat}
              tep={tep}
              onQbFormatChange={setQbFormat}
              onTepToggle={() => setTep((current) => !current)}
              scoreDeltas={scoreDeltas}
            />
          </div>
        </Container>
      </section>
    </>
  );
}
