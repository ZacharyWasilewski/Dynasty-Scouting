"use client";

import { useEffect, useState } from "react";
import type { PositionOpportunityHitRates } from "@/lib/analytics";
import { useAnalyticsPosition, type AnalyticsPosition } from "@/components/analytics/AnalyticsPositionContext";

const BAR_COLOR = "var(--color-accent)"; // accent
const LOW_SAMPLE_COLOR = "var(--color-ink-tertiary)";

const MIN_COLUMN_PX = 112;
const BAR_AREA_HEIGHT = 160;
const PCT_LABEL_RESERVE = 20;
const LABEL_AREA_PX = 40; // taller than TierHitRateChart's, depth-chart labels run longer

const POSITIONS: AnalyticsPosition[] = ["QB", "RB", "WR", "TE"];

export function OpportunityHitRateChart({ data }: { data: PositionOpportunityHitRates[] }) {
  const [mounted, setMounted] = useState(false);
  const { position, setPosition } = useAnalyticsPosition();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const active = data.find((d) => d.position === position);
  const drawable = BAR_AREA_HEIGHT - PCT_LABEL_RESERVE;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          Real hit rate for each Opportunity label
        </p>
        <div className="inline-flex border border-border bg-surface p-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              aria-pressed={position === pos}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors duration-150 ${
                position === pos ? "bg-accent text-void" : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {!active || active.options.length === 0 ? (
        <p className="text-sm text-ink-tertiary">No Opportunity data available for {position} yet.</p>
      ) : (
        <>
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary sm:hidden">
            Scroll to see all →
          </p>
          <div className="overflow-x-auto pb-1">
            <div
              className="flex items-end gap-3"
              style={{ height: BAR_AREA_HEIGHT + LABEL_AREA_PX, minWidth: active.options.length * MIN_COLUMN_PX }}
            >
              {active.options.map((o) => {
                const barPx = mounted ? (o.hitRate / 100) * drawable : 0;
                const color = o.lowSample ? LOW_SAMPLE_COLOR : BAR_COLOR;

                return (
                  <div
                    key={o.label}
                    className="flex h-full shrink-0 flex-col items-center justify-end gap-0.5"
                    style={{ width: MIN_COLUMN_PX, opacity: o.lowSample ? 0.6 : 1 }}
                  >
                    <div className="relative w-full" style={{ height: BAR_AREA_HEIGHT }}>
                      <span
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-medium text-ink"
                        style={{ bottom: barPx + 6 }}
                      >
                        {o.hitRate.toFixed(0)}%
                      </span>
                      <div
                        className="absolute bottom-0 left-0 w-full transition-all duration-700 ease-out"
                        style={{ height: barPx, backgroundColor: color }}
                      />
                    </div>
                    <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                      {o.label}
                    </span>
                    <span className="whitespace-nowrap font-mono text-[9px] text-ink-tertiary">
                      n={o.count}{o.lowSample ? " · small" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-ink-tertiary">
            Each bar is the real historical hit rate for every{" "}
            {position} who actually carried that exact Opportunity
            label, the same label you see on a player&apos;s profile,
            not a converted score. Grayed-out bars have fewer than 4
            resolved players behind them, so a single outcome can swing
            the number a lot; read those as a starting point, not a
            settled result.
          </p>
        </>
      )}
    </div>
  );
}
