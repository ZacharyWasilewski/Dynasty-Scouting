"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { TierSummaryRow, Prospect, Position } from "@/types/prospect";
import { TIER_DEFINITIONS, getTierColor } from "@/lib/tiers";
import { computeHitRateByTier } from "@/lib/analytics";

const MARQUEE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const NA_COLOR = "#3A404A";

/**
 * Real tier hit-rate data from the Google Sheet's summary table —
 * the share of prospects in each tier whose career matched that
 * tier's benchmark, computed by the user's own model across every
 * backtested prospect.
 *
 * The sheet's own tier labels (e.g. "1. Generational (Purple)") are
 * swapped for the site's standard tier names, matched by position —
 * both are always the same 8-tier, highest-to-lowest order.
 *
 * Tapping a tier expands it to show the same hit rate broken out by
 * position, computed live from the prospects themselves (not the
 * sheet, which only has the all-position aggregate). A position with
 * no resolved prospects in that tier shows a grey "N/A" bar.
 */
export function TierHitRates({
  rows,
  prospects,
}: {
  rows: TierSummaryRow[];
  prospects: Prospect[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // The sheet's summary table has a trailing "TOTAL" row after the 8
  // real tiers — drop it, since it doesn't correspond to any actual
  // tier and would otherwise render as a broken, always-N/A 9th row.
  const tierRows = rows.slice(0, TIER_DEFINITIONS.length);

  if (tierRows.length === 0) {
    return (
      <p className="text-sm text-ink-tertiary">
        Tier hit-rate data isn&apos;t available right now.
      </p>
    );
  }

  const max = Math.max(1, ...tierRows.map((r) => r.hitRate ?? 0));

  return (
    <div>
      <div className="flex flex-col divide-y divide-border border border-border">
        {tierRows.map((row, i) => {
          const displayName = TIER_DEFINITIONS[i]?.name ?? row.tier;
          const color = TIER_DEFINITIONS[i] ? getTierColor(TIER_DEFINITIONS[i].name) : undefined;
          const isOpen = expanded.has(displayName);
          const byPosition = isOpen
            ? MARQUEE_POSITIONS.map((pos) => {
                const result = computeHitRateByTier(prospects, [displayName], pos)[0] ?? {
                  tier: displayName,
                  hitRate: null,
                  count: 0,
                  total: 0,
                };
                return {
                  position: pos,
                  hitRate: result.hitRate,
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
                  <span className="hidden font-mono text-xs text-ink-tertiary sm:inline">
                    {row.prospects} prospects
                  </span>
                  <div className="h-1.5 w-24 bg-void sm:w-40">
                    <div
                      className="h-1.5 transition-all duration-700 ease-out"
                      style={{
                        width: `${((row.hitRate ?? 0) / max) * 100}%`,
                        backgroundColor: color ?? "#3B82F6",
                      }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-sm text-ink">
                    {row.hitRate !== null ? `${row.hitRate.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 bg-void px-4 py-3 pl-9">
                  {byPosition.map((p) => {
                    const barColor = p.hitRate !== null ? (color ?? "#3B82F6") : NA_COLOR;
                    const pct = p.hitRate !== null ? (p.hitRate / 100) * 100 : 8;
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
                          {p.hitRate !== null ? `${p.hitRate.toFixed(1)}%` : "N/A"}
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
                        href={`/players?position=${p.position}&tier=${encodeURIComponent(displayName)}`}
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
