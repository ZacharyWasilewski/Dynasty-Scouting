"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import type { BarDatum } from "@/lib/analytics";

// Reserved space at the top of the chart for the value label above
// the tallest bar — otherwise the largest bar pushes its own label
// out of the fixed-height container.
const LABEL_RESERVE_PX = 32;

export function BarChart({
  data,
  accent = "var(--color-accent)",
  emptyMessage = "No data yet.",
  valueSuffix = "",
  height = 200,
}: {
  data: BarDatum[];
  accent?: string;
  emptyMessage?: string;
  valueSuffix?: string;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));
  const hasData = data.some((d) => d.value > 0);
  const drawableHeight = Math.max(0, height - LABEL_RESERVE_PX);

  return (
    <div>
      {!hasData && (
        <div className="mb-4 flex items-center gap-2 text-ink-tertiary">
          <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
          <p className="text-xs">{emptyMessage}</p>
        </div>
      )}
      <div className="grid items-end gap-1.5 sm:gap-3" style={{ height, gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d) => {
          const barPx = mounted ? (d.value / max) * drawableHeight : 0;
          return (
            <div
              key={d.label}
              className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
            >
              <span className="whitespace-nowrap font-mono text-[10px] font-medium text-ink">
                {d.value}
                {valueSuffix}
                {d.count !== undefined && (
                  <span className="ml-0.5 text-ink-tertiary">({d.count})</span>
                )}
              </span>
              <div className="flex w-full flex-1 items-end bg-void">
                <div
                  className="w-full transition-all duration-700 ease-out"
                  style={{
                    height: `${barPx}px`,
                    minHeight: 3,
                    backgroundColor: accent,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
