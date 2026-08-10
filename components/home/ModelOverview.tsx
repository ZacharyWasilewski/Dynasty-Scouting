import { Container } from "@/components/layout/Container";
import { TIER_DEFINITIONS } from "@/lib/tiers";

export function ModelOverview() {
  return (
    <section className="border-b border-border bg-surface py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
            The Model
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
            Graded on what actually predicts NFL production.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every prospect is scored on a set of position-specific
            percentile metrics — production, athleticism, draft capital,
            and more — weighted differently for a QB than a WR. Those
            scores roll up into a single Prospect Score, then sort into
            one of eight tiers.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4 lg:grid-cols-8">
          {TIER_DEFINITIONS.map((tier) => (
            <div key={tier.name} className="bg-surface p-4">
              <span
                className="block h-1.5 w-6"
                style={{ backgroundColor: tier.color }}
              />
              <span className="mt-3 block font-mono text-[11px] font-medium uppercase tracking-wide text-ink">
                {tier.name}
              </span>
              <span className="mt-1 block font-mono text-[11px] text-ink-tertiary">
                {tier.min}+
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
