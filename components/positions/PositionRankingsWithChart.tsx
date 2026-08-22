"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { PositionExplorer } from "@/components/positions/PositionExplorer";
import { computeHitRateByTier, selectionFromLeagueFormat } from "@/lib/analytics";
import { ALL_TIERS, getTierColor } from "@/lib/tiers";
import { wasRecentBackNavigation, getSavedFormatForPath, saveFormatForPath } from "@/lib/formatPersistence";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";
import type { LeagueFormat } from "@/lib/ddScore";
import type { Prospect, Tier } from "@/types/prospect";
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

  // One aggregate, headline-worthy number for the integrated stat
  // line — real hits over real resolved outcomes across the two
  // highest tiers specifically (not a blended "overall" hit rate,
  // which would dilute a meaningful claim with tiers nobody expects
  // to hit anyway). Derived the same way the per-tier hit count is
  // derived elsewhere on the site: hitRate% of the resolved count,
  // not a separately-tracked number.
  const eliteAndAbove = hitRateByTier.filter((d) => d.tier === "Generational" || d.tier === "Elite");
  const eliteResolvedTotal = eliteAndAbove.reduce((sum, d) => sum + d.count, 0);
  const eliteHitsTotal = eliteAndAbove.reduce(
    (sum, d) => sum + (d.hitRate !== null ? Math.round((d.hitRate / 100) * d.count) : 0),
    0
  );
  const eliteHitRate = eliteResolvedTotal > 0 ? (eliteHitsTotal / eliteResolvedTotal) * 100 : undefined;

  return (
    <>
      {/* MODEL PERFORMANCE — one integrated stat line (prospect
          count + the model's actual track record at the top of its
          own scale) immediately followed by compact per-tier rows,
          not a separate "report" section with its own heading,
          explanatory paragraph, and bordered chart container. This
          used to be a full horizontal bar chart requiring "scroll to
          see all →" on mobile — replaced with rows, which read
          cleanly at any width and don't need a scroll affordance at
          all. The point isn't decoration; it's that this is where
          "DD Score → tier → historical record" actually becomes
          visible, right before the individual prospects earning
          those grades. */}
      <section className="border-b border-border bg-surface py-10">
        <Container>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
            <span className="font-headline text-2xl text-ink">{prospects.length}</span>{" "}
            {theme.label.toLowerCase()} graded.
            {eliteHitRate !== undefined && (
              <>
                {" "}Prospects earning a Generational or Elite grade have hit{" "}
                <span className="font-semibold" style={{ color: theme.accent }}>
                  {eliteHitRate.toFixed(0)}% of the time
                </span>{" "}
                historically.
              </>
            )}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {hitRateByTier.map((d) => {
              const color = d.hitRate !== null ? getTierColor(d.tier as Tier) : "var(--color-border-strong)";
              return (
                <Link
                  key={d.tier}
                  href={`/players?position=${theme.code}&tier=${encodeURIComponent(d.tier)}`}
                  className="group flex items-center gap-3"
                >
                  <span className="w-28 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-tertiary group-hover:text-ink sm:w-32">
                    {d.tier}
                  </span>
                  {/* A 10-square icon array instead of the Class
                      page's solid proportional bars — deliberately a
                      different visual texture for a different kind
                      of number. The Class page's bars represent a
                      count relative to the class's own largest group
                      (a share of a whole); this represents a
                      probability out of 10, closer to "7 out of 10
                      would hit" than to a proportional fill. */}
                  <div className="flex flex-1 items-center gap-[3px]">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const filled = d.hitRate !== null && i < Math.round(d.hitRate / 10);
                      return (
                        <span
                          key={i}
                          className="h-2.5 w-2.5 shrink-0"
                          style={{ backgroundColor: filled ? color : "var(--color-border-strong)" }}
                        />
                      );
                    })}
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] font-semibold text-ink">
                    {d.hitRate !== null ? `${d.hitRate.toFixed(0)}%` : "—"}
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] text-ink-tertiary">
                    {d.total}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-ink-tertiary">
            Each square ≈ 10% historical hit rate · right column = prospects in tier
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
