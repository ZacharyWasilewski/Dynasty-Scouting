import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import type { Prospect } from "@/types/prospect";

export function DraftClasses({ prospects }: { prospects: Prospect[] }) {
  const counts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) counts.set(p.draftClass, (counts.get(p.draftClass) ?? 0) + 1);
  });

  // Always show the current + upcoming cycles, even before any
  // prospects have been graded for them, alongside every real class
  // year found in the data.
  const UPCOMING_FLOOR = ["2025", "2026", "2027", "2028"];
  const years = [...new Set([...counts.keys(), ...UPCOMING_FLOOR])]
    .filter((y) => Number(y) >= 2015)
    .sort((a, b) => Number(b) - Number(a));

  return (
    <section id="classes" className="border-b border-border bg-surface py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
            Draft Classes
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
            Every class, since 2015.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Boards stay open after the draft so you can look back on how a
            class actually played out.
          </p>
        </div>

        {years.length === 0 ? (
          <p className="mt-10 text-sm text-ink-tertiary">
            No draft classes have been graded yet.
          </p>
        ) : (
          <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {years.map((year) => {
              const count = counts.get(year) ?? 0;
              return (
                <Link
                  key={year}
                  href={`/classes/${year}`}
                  className="group relative flex flex-col justify-between border border-border bg-void p-6 transition-all duration-200 hover:-translate-y-1 hover:border-border-strong"
                >
                  <span className="font-mono text-3xl font-semibold text-ink transition-colors duration-200 group-hover:text-accent sm:text-4xl">
                    {year}
                  </span>
                  <Badge tone="outline" className="mt-6 self-start">
                    {count > 0 ? `${count} prospects` : "Early Look"}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
