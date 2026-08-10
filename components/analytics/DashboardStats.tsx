import type { Prospect } from "@/types/prospect";
import { overallStats } from "@/lib/analytics";

// Each QB is graded on 7 data points; RB/WR/TE are graded on 8.
const DATA_POINTS_PER_POSITION: Record<string, number> = {
  QB: 7,
  RB: 8,
  WR: 8,
  TE: 8,
};

export function DashboardStats({ prospects }: { prospects: Prospect[] }) {
  const stats = overallStats(prospects);

  const totalDataPoints = prospects.reduce(
    (sum, p) => sum + (DATA_POINTS_PER_POSITION[p.position] ?? 0),
    0
  );

  const items = [
    { label: "Prospects Tracked", value: String(stats.total) },
    { label: "Prospects Scored", value: String(stats.scored) },
    { label: "Total Data Points", value: String(totalDataPoints) },
    { label: "Draft Classes", value: String(stats.classesTracked) },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface p-6">
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">
            {item.label}
          </span>
          <p className="mt-2 font-display text-4xl font-bold tracking-tightest text-ink sm:text-5xl">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
