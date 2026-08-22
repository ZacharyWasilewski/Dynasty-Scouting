import { Container } from "@/components/layout/Container";
import { TIER_DEFINITIONS } from "@/lib/tiers";

export function ModelOverview() {
  // Each tier's actual width on the 0-100 scale — these are NOT
  // evenly spaced (Generational is a tight 95-100 band; Roster
  // Clogger covers 0-29, six times as wide) and the old 8-equal-box
  // grid quietly implied otherwise. A proportional bar is both more
  // distinctive and more honest about what the tiers actually are.
  const segments = TIER_DEFINITIONS.map((tier, i) => {
    const max = i === 0 ? 100 : TIER_DEFINITIONS[i - 1]!.min;
    return { ...tier, width: max - tier.min };
  });

  return (
    <section className="theme-dark border-b border-border bg-void py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
            The Model
          </span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Graded on what actually predicts NFL production.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every prospect is scored on a set of position-specific
            percentile metrics — production, athleticism, draft capital,
            and more — weighted differently for a QB than a WR. Those
            scores roll up into a single Positional Score, then get
            calibrated against historical outcomes into a Dynasty
            Database Score, and sort into one of eight tiers.
          </p>
        </div>

        <p className="mt-12 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
          The full 0–100 scale, to real proportion
        </p>
        <div className="mt-3 flex h-16 w-full overflow-hidden sm:h-20">
          {segments.map((tier) => (
            <div
              key={tier.name}
              className="group relative h-full transition-[flex-grow] duration-200"
              style={{ flexGrow: tier.width, flexBasis: 0, backgroundColor: tier.color }}
              title={`${tier.name} — ${tier.min}+`}
            />
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
              <span className="shrink-0 font-mono text-[11px] text-ink-tertiary">{tier.min}+</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
