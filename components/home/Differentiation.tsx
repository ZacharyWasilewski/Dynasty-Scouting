import { Container } from "@/components/layout/Container";

const ROWS: { label: string; crowd: string; model: string; detail: string }[] = [
  {
    label: "Where the number comes from",
    crowd: "Aggregated opinion",
    model: "Calibrated against outcomes.",
    detail: "Real historical results since 2015, not what enough people happened to rank someone.",
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
    model: "The moment new data exists.",
    detail: "New production, athleticism, or draft capital — reflected immediately, not eventually.",
  },
  {
    label: "What backs the number",
    crowd: "Consensus",
    model: "A hit rate you can check.",
    detail: "The model's actual accuracy, tracked openly on the Analytics page.",
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
    <section className="border-b border-border bg-surface py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">What&apos;s Different</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Built different,
            <br />
            on purpose.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Most dynasty sites rank players by consensus. This one grades them against what they actually became.
          </p>
        </div>

        <div className="mt-14 flex flex-col divide-y divide-border border-t border-border">
          {ROWS.map((row) => (
            <div key={row.label} className="grid grid-cols-1 gap-1 py-6 sm:grid-cols-[220px_1fr] sm:gap-6 sm:py-8">
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">{row.label}</p>
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
