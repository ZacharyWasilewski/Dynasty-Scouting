"use client";

import { cn } from "@/lib/utils";

/**
 * Deliberately not a generic circular spinner — a thin horizontal
 * accent line that fills as the pull progresses and then sweeps once
 * while refreshing reads as a refined, native-feeling interaction
 * rather than a stock SaaS loading affordance, and costs almost no
 * vertical space (no layout shift) since it only ever occupies a few
 * pixels of height.
 */
export function PullToRefreshIndicator({
  pullDistance,
  threshold,
  refreshing,
}: {
  pullDistance: number;
  threshold: number;
  refreshing: boolean;
}) {
  if (pullDistance <= 0 && !refreshing) return null;
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      aria-live="polite"
      aria-label={refreshing ? "Refreshing" : undefined}
      className="pointer-events-none sticky top-0 z-20 h-[3px] w-full overflow-hidden bg-transparent"
      style={{ marginBottom: refreshing ? 0 : -3 }}
    >
      <div
        className={cn(
          "h-full bg-accent transition-[width] duration-150",
          refreshing ? "w-1/3 animate-pull-refresh-sweep" : undefined
        )}
        style={refreshing ? undefined : { width: `${progress * 100}%` }}
      />
    </div>
  );
}
