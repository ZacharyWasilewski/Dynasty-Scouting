"use client";

import { useEffect, useState } from "react";
import type { PositionSubScoreSignal } from "@/lib/analytics";
import type { Position } from "@/types/prospect";

const BOTTOM_COLOR = "var(--color-border-strong)";
const TOP_COLOR = "var(--color-accent)"; // accent

const GROUP_WIDTH = 132;
const BAR_WIDTH = 34;
const BAR_AREA_HEIGHT = 160;
const PCT_LABEL_RESERVE = 20;

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

export function SubScoreSignalChart({ signals }: { signals: PositionSubScoreSignal[] }) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position>("QB");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const active = signals.find((s) => s.position === position);
  // Only metrics with enough historical data to actually compare —
  // no N/A placeholders taking up space in the chart.
  const withData = active?.signals.filter((s) => s.bottomHitRate !== null && s.topHitRate !== null) ?? [];
  const drawable = BAR_AREA_HEIGHT - PCT_LABEL_RESERVE;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          Top third vs. bottom third hit rate, per input
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

      {withData.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Not enough resolved outcomes yet for {position}.</p>
      ) : (
        <>
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary sm:hidden">
            Scroll to see all →
          </p>
          <div className="overflow-x-auto pb-1">
            <div className="flex items-end gap-4" style={{ minWidth: withData.length * GROUP_WIDTH }}>
              {withData.map((s) => {
                const bottomPx = mounted ? ((s.bottomHitRate ?? 0) / 100) * drawable : 0;
                const topPx = mounted ? ((s.topHitRate ?? 0) / 100) * drawable : 0;

                return (
                  <div key={s.index} className="flex shrink-0 flex-col items-center gap-2" style={{ width: GROUP_WIDTH }}>
                    <div className="flex items-end gap-2" style={{ height: BAR_AREA_HEIGHT }}>
                      <div className="relative flex flex-col items-center justify-end" style={{ width: BAR_WIDTH, height: BAR_AREA_HEIGHT }}>
                        <span
                          className="absolute whitespace-nowrap font-mono text-[10px] text-ink-secondary"
                          style={{ bottom: bottomPx + 6 }}
                        >
                          {s.bottomHitRate!.toFixed(0)}%
                        </span>
                        <div
                          className="w-full transition-all duration-700 ease-out"
                          style={{ height: bottomPx, backgroundColor: BOTTOM_COLOR }}
                        />
                      </div>
                      <div className="relative flex flex-col items-center justify-end" style={{ width: BAR_WIDTH, height: BAR_AREA_HEIGHT }}>
                        <span
                          className="absolute whitespace-nowrap font-mono text-[10px] font-semibold text-ink"
                          style={{ bottom: topPx + 6 }}
                        >
                          {s.topHitRate!.toFixed(0)}%
                        </span>
                        <div
                          className="w-full transition-all duration-700 ease-out"
                          style={{ height: topPx, backgroundColor: TOP_COLOR }}
                        />
                      </div>
                    </div>
                    <span
                      className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: s.lift! >= 0 ? "var(--color-riser)" : "var(--color-faller)" }}
                    >
                      {s.lift! >= 0 ? "+" : ""}{s.lift!.toFixed(0)} pts
                    </span>
                    <span className="whitespace-nowrap text-center font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
              <span className="h-2 w-2" style={{ backgroundColor: BOTTOM_COLOR }} />
              Bottom third on that metric
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
              <span className="h-2 w-2" style={{ backgroundColor: TOP_COLOR }} />
              Top third on that metric
            </span>
          </div>

          <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-tertiary">
            For each of {position}&apos;s inputs with enough historical
            data, prospects are split into three equal-sized groups
            from lowest to highest on that one metric, then the bottom
            group and top group are compared by real hit rate. A
            bigger gap (&ldquo;lift&rdquo;) means that one input, on
            its own, does a better job of predicting who hits.
          </p>
        </>
      )}
    </div>
  );
}
