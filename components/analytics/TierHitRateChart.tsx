"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { getTierColor } from "@/lib/tiers";
import type { Tier, Position } from "@/types/prospect";
import type { TierHitRateDatum } from "@/lib/analytics";

const NA_COLOR = "var(--color-border-strong)";
// Wide enough that even "Roster Clogger" fits on one line without wrapping.
const MIN_COLUMN_PX = 112;
// Height of the tier-name row beneath each bar.
const TIER_LABEL_AREA_PX = 24;
// Space reserved above the tallest possible bar so its percentage
// label always has room, no matter how tall that specific bar is.
const PCT_LABEL_RESERVE_PX = 22;

export function TierHitRateChart({
  data,
  position,
  height = 220,
  emptyMessage = "No resolved outcomes yet.",
  linkToPlayers = true,
}: {
  data: TierHitRateDatum[];
  position: Position;
  height?: number;
  emptyMessage?: string;
  linkToPlayers?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const hasData = data.some((d) => d.hitRate !== null);
  const barAreaHeight = Math.max(0, height - TIER_LABEL_AREA_PX);
  const drawableHeight = Math.max(0, barAreaHeight - PCT_LABEL_RESERVE_PX);

  return (
    <div>
      <p className="mb-4 font-mono text-[9px] uppercase tracking-widest text-ink-tertiary">
        Percent = historical hit rate · count = prospects in tier
      </p>
      {!hasData && (
        <div className="mb-4 flex items-center gap-2 text-ink-tertiary">
          <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
          <p className="text-xs">{emptyMessage}</p>
        </div>
      )}
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary sm:hidden">
        Scroll to see all →
      </p>
      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-end gap-3"
          style={{ height, minWidth: `${data.length * MIN_COLUMN_PX}px` }}
        >
          {data.map((d) => {
            const barPx = mounted && d.hitRate !== null ? (d.hitRate / 100) * drawableHeight : 0;
            const color = d.hitRate !== null ? getTierColor(d.tier as Tier) : NA_COLOR;

            const inner = (
              <>
                <div className="relative w-full" style={{ height: barAreaHeight }}>
                  <span
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-medium text-ink"
                    style={{ bottom: `${(d.hitRate !== null ? barPx : 0) + 6}px` }}
                  >
                    {d.hitRate !== null ? `${d.hitRate.toFixed(0)}%` : "N/A"}
                  </span>
                  <div
                    className="absolute bottom-0 left-0 w-full transition-all duration-700 ease-out"
                    style={{
                      height: d.hitRate !== null ? `${barPx}px` : "3px",
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                  {d.tier} ({d.total})
                </span>
              </>
            );

            if (d.hitRate === null) {
              return (
                <div
                  key={d.tier}
                  className="flex h-full shrink-0 flex-col items-center justify-end gap-0.5 opacity-60"
                  style={{ width: MIN_COLUMN_PX }}
                >
                  {inner}
                </div>
              );
            }

            if (!linkToPlayers) {
              return (
                <div
                  key={d.tier}
                  className="flex h-full shrink-0 flex-col items-center justify-end gap-0.5"
                  style={{ width: MIN_COLUMN_PX }}
                >
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={d.tier}
                href={`/players?position=${position}&tier=${encodeURIComponent(d.tier)}`}
                className="group flex h-full shrink-0 flex-col items-center justify-end gap-0.5 transition-opacity duration-150 hover:opacity-80"
                style={{ width: MIN_COLUMN_PX }}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
