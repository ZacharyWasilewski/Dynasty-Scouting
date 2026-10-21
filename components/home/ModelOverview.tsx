import { Container } from "@/components/layout/Container";
import { TIER_DEFINITIONS } from "@/lib/tiers";

export function ModelOverview() {
  // Score intervals share a fixed 0–100 axis, increasing left to right.
  const segments = [...TIER_DEFINITIONS].reverse().map((tier, i, tiers) => {
    const max = tiers[i + 1]?.min ?? 100;
    return { ...tier, max, width: max - tier.min };
  });

  return (
    <section className="theme-dark border-b border-border bg-void py-10 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <span className="font-headline text-sm uppercase text-accent">
            The Model
          </span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Graded on what predicts success for your dynasty team.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every prospect is scored on a set of position-specific
            percentile metrics, including production, athleticism, draft
            capital, and more, weighted differently depending on position.
            Those scores roll up into a single Positional Score, then get
            calibrated against historical outcomes into a Dynasty Database
            Score and sorted into one of eight tiers.
          </p>
        </div>

        <p className="mt-12 font-headline text-sm uppercase text-ink-tertiary">
          DD Score ranges by tier
        </p>
        <div className="mt-3 flex h-16 w-full overflow-hidden sm:h-20">
          {segments.map((tier) => (
            <div
              key={tier.name}
              className="relative h-full shrink-0"
              style={{ width: `${tier.width}%`, backgroundColor: tier.color }}
              title={`${tier.name}: ${tier.min}–${tier.max}${tier.max === 100 ? " inclusive" : " (upper bound excluded)"}`}
            />
          ))}
        </div>

        <div className="relative mt-1 h-5 font-data text-[10px] text-ink-tertiary" aria-label="Score axis: 0 to 100">
          {[0, 25, 50, 75, 100].map((score) => (
            <span
              key={score}
              className="absolute top-0 border-t border-border pt-1"
              style={{ left: `${score}%`, transform: score === 0 ? undefined : score === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {score}
            </span>
          ))}
        </div>

        {/* Grid instead of flex-wrap — tier names vary a lot in
            length ("Generational" vs "Flex"), which made free-
            flowing flex-wrap wrap ragged, uneven numbers of items
            per row on narrow screens (looked jumbled/misaligned on
            mobile specifically). A fixed column count wraps
            predictably instead. */}
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {TIER_DEFINITIONS.map((tier) => (
            <div key={tier.name} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
              <span className="truncate font-mono text-[11px] font-medium uppercase tracking-wide text-ink">
                {tier.name}
              </span>
              <span className="shrink-0 font-data text-[11px] text-ink-tertiary">{tier.min}+</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
