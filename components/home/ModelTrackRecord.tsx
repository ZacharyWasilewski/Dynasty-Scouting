import { Target, Database, Layers, TrendingUp } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { computeCombinedHitRate, overallStats } from "@/lib/analytics";
import type { Prospect } from "@/types/prospect";

/**
 * Every number here is computed live from the same underlying data
 * the rest of the site uses — nothing here is a marketing figure
 * invented for this section specifically. If the hit rate reads
 * differently than expected, that's the actual current number, not
 * a copy bug.
 */
export function ModelTrackRecord({ prospects }: { prospects: Prospect[] }) {
  const stats = overallStats(prospects);
  const topTier = computeCombinedHitRate(prospects, ["Generational", "Elite"]);

  const secondaryItems = [
    {
      icon: Database,
      value: String(stats.total),
      label: "Prospects Graded",
      detail: "Every dynasty-relevant rookie tracked since 2015, still growing.",
    },
    {
      icon: Layers,
      value: String(stats.classesTracked),
      label: "Draft Classes",
      detail: "Full historical boards, not just the current cycle.",
    },
    {
      icon: TrendingUp,
      value: "4",
      label: "Position-Specific Models",
      detail: "QB, RB, WR, TE — each graded on its own metrics, calibrated separately.",
    },
  ];

  return (
    <section className="border-b border-border bg-void py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Track Record</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Built on outcomes,
            <br />
            not opinions.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every grade is checked against what a prospect actually became — this is the model&apos;s real, current
            track record, not a curated highlight.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {/* The one number that actually matters most gets its own
              scale, not a slot equal to "how many classes are
              tracked" — a decorative ring behind the percentage
              reads as "this is a completion rate," reinforcing what
              the number means before anyone reads the label. */}
          {topTier && (
            <div className="relative flex flex-col justify-center overflow-hidden border border-border-strong bg-surface p-8 lg:col-span-2">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border-[18px] opacity-[0.14]"
                style={{ borderColor: "#7C3AED" }}
              />
              <Target className="h-6 w-6 text-accent" strokeWidth={1.75} />
              <p className="relative mt-4 font-headline text-7xl leading-none text-ink sm:text-8xl lg:text-9xl">
                {Math.round(topTier.hitRate)}
                <span className="text-4xl sm:text-5xl">%</span>
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                Elite+ Tier Hit Rate
              </p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-tertiary">
                Across {topTier.sampleSize} resolved Generational/Elite grades since 2015.
              </p>
            </div>
          )}

          <div className={`grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3 ${topTier ? "lg:col-span-3" : "lg:col-span-5"}`}>
            {secondaryItems.map((item) => (
              <div key={item.label} className="flex flex-col bg-surface p-6">
                <item.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                <p className="mt-4 font-headline text-4xl leading-none text-ink">{item.value}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">{item.label}</p>
                <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
