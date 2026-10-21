import { Container } from "@/components/layout/Container";

const ROWS: { label: string; crowd: string; model: string; detail: string }[] = [
  {
    label: "Where the number comes from",
    crowd: "Aggregated opinion",
    model: "Calibrated against outcomes.",
    detail: "Historical outcomes provide context for each grade. Retrospective fit does not guarantee future results.",
  },
  {
    label: "How it treats positions",
    crowd: "One ranking for everyone",
    model: "Graded position by position.",
    detail: "A QB and a WR are scored on completely different metrics, weighted differently.",
  },
  {
    label: "When it updates",
    crowd: "When enough opinions come in",
    model: "When the source data refreshes.",
    detail: "Scores refresh after updated inputs are published to the source sheet and the site completes its refresh.",
  },
  {
    label: "What backs the number",
    crowd: "Consensus",
    model: "The hit rate above, not a promise.",
    detail: "Same number you just saw. It's checked against real outcomes, not asserted.",
  },
];

/**
 * Deliberately not a comparison table — a "crossed out, corrected"
 * typographic device instead, closer to how someone might actually
 * mark up a scouting sheet than to a SaaS feature-comparison grid.
 * Named generically ("most dynasty sites") rather than any specific
 * competitor.
 */
export function Differentiation() {
  return (
    <section className="bg-surface py-12 sm:py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-headline text-sm uppercase text-accent">What&apos;s Different</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            More than consensus.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Dynasty Database grades prospects using position-specific inputs and historical outcomes. Use its research alongside market rankings to understand where evaluations differ.
          </p>
        </div>

        <div className="mt-14 flex flex-col divide-y divide-border border-t border-border">
          {ROWS.map((row) => (
            <div key={row.label} className="grid grid-cols-1 gap-1 py-6 sm:grid-cols-[220px_1fr] sm:gap-6 sm:py-8">
              <p className="font-headline text-sm uppercase text-ink-tertiary">{row.label}</p>
              <div>
                <p className="text-base text-ink-tertiary line-through decoration-faller/50 decoration-2">
                  {row.crowd}
                </p>
                <p className="mt-1.5 font-headline text-2xl uppercase leading-tight text-ink sm:text-3xl">
                  {row.model}
                </p>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary">{row.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
