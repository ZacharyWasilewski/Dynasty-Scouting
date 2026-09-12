"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "@/components/ui/SiteIcons";
import type { Prospect, Position } from "@/types/prospect";
import { ALL_TIERS, TIER_DEFINITIONS, getTierColor } from "@/lib/tiers";
import { computeHitRateByTier, formatQueryValue, type TierHitRateDatum } from "@/lib/analytics";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

const MARQUEE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const NA_COLOR = "var(--color-border-strong)";

function valueOf(row: TierHitRateDatum, weighted: boolean): number | null {
  return weighted ? row.valueScore : row.hitRate;
}

function formatValue(v: number | null, weighted: boolean): string {
  if (v === null) return weighted ? "N/A" : "—";
  return weighted ? `${v.toFixed(0)}%` : `${v.toFixed(1)}%`;
}

/**
 * Standard mode: hit rates are calculated from the FINAL Dynasty Database
 * Score tiers. Weighted mode: the same tier buckets, averaged instead by
 * real fantasy-finish quality (see lib/analytics.ts FINISH_WEIGHTS) — RP
 * = 50 is a push, Bust = 0, SuperStar scores 130 individually — but the
 * displayed average is capped at 100. The legacy
 * spreadsheet tier summary is intentionally not used here, because those
 * historical tiers were based on the old Prospect Score.
 *
 * Tapping a tier expands it to show the same tier's rate/score broken
 * out by position. A position with no resolved prospects in that tier
 * shows a grey "N/A" bar.
 */
export function TierHitRates({
  prospects,
}: {
  prospects: Prospect[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { mode } = useScoringMode();
  const weighted = mode === "weighted";
  const { selection } = useLeagueFormat();

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const tierRows = computeHitRateByTier(prospects, ALL_TIERS, undefined, selection);

  if (tierRows.length === 0) {
    return (
      <p className="text-sm text-ink-tertiary">
        Tier hit-rate data isn&apos;t available right now.
      </p>
    );
  }

  const max = Math.max(1, ...tierRows.map((r) => valueOf(r, weighted) ?? 0));

  return (
    <div>
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
        {weighted ? "Showing Weighted Value Score (RP = 50)" : "Showing Standard Hit Rate"}
        {" · "}
        {selection.qbFormat === "1QB" ? "1QB" : "Superflex"}
        {selection.tepFormat === "TEP" ? " TEP" : ""}
      </div>
      {/* Explains what these percentages actually mean — the site's own
          past prospects landing in this tier, not a forward-looking
          probability for any one specific player. A "75% hit rate"
          reads, without this line, like "this player has a 75% chance"
          — it isn't; it's a description of the historical group this
          player's grade places them in. */}
      <p className="mb-4 max-w-xl text-xs leading-relaxed text-ink-tertiary">
        These are historical outcome rates — how often past prospects who landed in each tier went on to hit,
        not a probability for any individual player.
      </p>
      <div className="flex flex-col divide-y divide-border border border-border">
        {tierRows.map((row, i) => {
          const displayName = TIER_DEFINITIONS[i]?.name ?? row.tier;
          const color = TIER_DEFINITIONS[i] ? getTierColor(TIER_DEFINITIONS[i].name) : undefined;
          const isOpen = expanded.has(displayName);
          const rowValue = valueOf(row, weighted);
          const byPosition = isOpen
            ? MARQUEE_POSITIONS.map((pos) => {
                const result = computeHitRateByTier(prospects, [displayName], pos, selection)[0] ?? {
                  tier: displayName,
                  hitRate: null,
                  count: 0,
                  total: 0,
                  valueScore: null,
                  valueCount: 0,
                };
                return {
                  position: pos,
                  value: valueOf(result, weighted),
                  count: result.count,
                  total: result.total,
                };
              })
            : [];

          return (
            <div key={row.tier}>
              <button
                onClick={() => toggle(displayName)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-raised"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-ink-tertiary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                  <span className="min-w-0 truncate font-mono text-sm font-medium" style={{ color }}>
                    {displayName}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden font-data text-xs text-ink-tertiary sm:inline">
                    {row.total} prospects
                  </span>
                  <div className="h-1.5 w-24 bg-void sm:w-40">
                    <div
                      className="h-1.5 transition-all duration-700 ease-out"
                      style={{
                        width: `${((rowValue ?? 0) / max) * 100}%`,
                        backgroundColor: color ?? "var(--color-accent)",
                      }}
                    />
                  </div>
                  <span className="w-14 text-right font-data text-sm text-ink">
                    {formatValue(rowValue, weighted)}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 bg-void px-4 py-3 pl-9">
                  {byPosition.map((p) => {
                    const barColor = p.value !== null ? (color ?? "var(--color-accent)") : NA_COLOR;
                    const pct = p.value !== null ? Math.min(100, (p.value / max) * 100) : 8;
                    const rowContent = (
                      <>
                        <span className="w-8 shrink-0 font-mono text-xs text-ink-tertiary">
                          {p.position}
                        </span>
                        <span className="w-7 shrink-0 text-right font-mono text-[11px] text-ink-tertiary">
                          ({p.total})
                        </span>
                        <div className="h-1.5 flex-1 bg-surface-raised">
                          <div
                            className="h-1.5 transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-secondary">
                          {formatValue(p.value, weighted)}
                        </span>
                      </>
                    );

                    if (p.total === 0) {
                      return (
                        <div key={p.position} className="flex items-center gap-3 opacity-60">
                          {rowContent}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={p.position}
                        href={`/players?position=${p.position}&tier=${encodeURIComponent(displayName)}&format=${formatQueryValue(selection)}`}
                        className="group flex items-center gap-3 -mx-1 px-1 py-0.5 transition-colors duration-150 hover:bg-surface-raised"
                      >
                        {rowContent}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
