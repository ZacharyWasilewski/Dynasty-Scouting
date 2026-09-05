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
    { label: "Draft Classes Graded", value: String(stats.classesTracked) },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-[142px] flex-col items-center justify-center bg-surface p-4 text-center sm:min-h-[164px] sm:p-6">
          <span className="max-w-full font-mono text-[10px] uppercase leading-relaxed tracking-widest2 text-ink-tertiary sm:text-[11px]">
            {item.label}
          </span>
          <p className="mt-2 font-headline text-4xl leading-none text-ink sm:text-5xl">
            {item.value}
          </p>
        </div>
      ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-tertiary">Tracked = unique prospects in the canonical database. Scored = prospects with a computed overall model score. The two populations are intentionally different.</p>
    </div>
  );
}
