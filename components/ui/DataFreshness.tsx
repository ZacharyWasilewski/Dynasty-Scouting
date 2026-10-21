import { cn } from "@/lib/utils";

/**
 * Small, unobtrusive "Updated <date>" stamp. Date-level granularity
 * (not a live clock/relative time) deliberately: the sheet snapshot
 * refreshes on a ~60s cycle regardless of whether the underlying
 * content actually changed, so a live "X seconds ago" would look
 * precise without being meaningful. A day-level date communicates
 * "this is current" without implying more than it can back up.
 */
export function DataFreshness({ lastUpdated, className }: { lastUpdated: Date | null; className?: string }) {
  if (!lastUpdated) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(lastUpdated);

  return (
    <span className={cn("font-headline text-sm uppercase text-ink-tertiary", className)}>
      Updated {formatted}
    </span>
  );
}
