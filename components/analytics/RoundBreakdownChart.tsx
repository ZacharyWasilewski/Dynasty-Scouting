"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";

const ROUND_COLORS = ["#1E40AF", "#3B82F6", "#60A5FA", "#93C5FD"];
const ROUND_LABELS = ["R1", "R2", "R3", "R4"];

// Each individual round-bar gets this much width, wide enough that
// its value label never collides with its neighbors.
const MIN_BAR_PX = 40;
const BAR_GAP_PX = 4;
const MIN_GROUP_PX = MIN_BAR_PX * 4 + BAR_GAP_PX * 3;
// Reserved space at the top of the chart for the value label above
// the tallest bar — otherwise Round 1 (usually the tallest) pushes
// its own label out of the fixed-height container.
const LABEL_RESERVE_PX = 40;

export interface RoundGroup {
  label: string; // class year
  rounds: (number | null)[]; // exactly 4 values, one per round
}

export function RoundBreakdownChart({
  data,
  valueSuffix = "",
  emptyMessage = "No data yet.",
  height = 260,
}: {
  data: RoundGroup[];
  valueSuffix?: string;
  emptyMessage?: string;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(1, ...data.flatMap((c) => c.rounds.map((v) => v ?? 0)));
  const hasData = data.some((c) => c.rounds.some((v) => v !== null));
  const drawableHeight = Math.max(0, height - LABEL_RESERVE_PX);

  return (
    <div>
      {!hasData && (
        <div className="mb-4 flex items-center gap-2 text-ink-tertiary">
          <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
          <p className="text-xs">{emptyMessage}</p>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-end gap-4"
          style={{ height, minWidth: `${data.length * (MIN_GROUP_PX + 16)}px` }}
        >
          {data.map((c) => (
            <div
              key={c.label}
              className="flex h-full shrink-0 flex-col items-center justify-end gap-2"
              style={{ minWidth: MIN_GROUP_PX }}
            >
              <div className="flex w-full flex-1 items-end justify-center" style={{ gap: BAR_GAP_PX }}>
                {c.rounds.map((val, ri) => {
                  const barPx = mounted ? ((val ?? 0) / max) * drawableHeight : 0;
                  return (
                    <div
                      key={ri}
                      className="flex h-full flex-col items-center justify-end"
                      style={{ width: MIN_BAR_PX }}
                    >
                      {val !== null && (
                        <span
                          className="mb-1 whitespace-nowrap font-mono text-[10px] font-medium text-ink"
                        >
                          {val.toFixed(1)}
                          {valueSuffix}
                        </span>
                      )}
                      <div
                        className="w-full transition-all duration-700 ease-out"
                        style={{
                          height: `${barPx}px`,
                          minHeight: val !== null ? 3 : 0,
                          backgroundColor: val !== null ? ROUND_COLORS[ri] : "#232830",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {ROUND_LABELS.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
            <span className="h-2 w-2" style={{ backgroundColor: ROUND_COLORS[i] }} />
            Round {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
