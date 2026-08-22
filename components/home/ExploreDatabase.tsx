import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Badge } from "@/components/ui/Badge";
import type { Prospect } from "@/types/prospect";

const POSITIONS = [
  { abbr: "QB", label: "Quarterbacks", href: "/positions/qb" },
  { abbr: "RB", label: "Running Backs", href: "/positions/rb" },
  { abbr: "WR", label: "Wide Receivers", href: "/positions/wr" },
  { abbr: "TE", label: "Tight Ends", href: "/positions/te" },
];

/**
 * Was two separate, near-identical sections (PositionNav,
 * DraftClasses) — same card grid, same "eyebrow + heading +
 * paragraph" header, just browsing by a different axis. Combining
 * them into one shared header with two labeled rows removes an
 * actually-redundant section rather than just re-skinning it, per
 * the instruction to combine overlapping sections rather than keep
 * every one distinct for its own sake.
 */
export function ExploreDatabase({ prospects }: { prospects: Prospect[] }) {
  const counts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) counts.set(p.draftClass, (counts.get(p.draftClass) ?? 0) + 1);
  });
  const UPCOMING_FLOOR = ["2025", "2026", "2027", "2028"];
  const years = [...new Set([...counts.keys(), ...UPCOMING_FLOOR])]
    .filter((y) => Number(y) >= 2015)
    .sort((a, b) => Number(b) - Number(a));

  return (
    <section id="explore" className="theme-dark border-b border-border bg-void py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Explore the Database</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Every position,
            <br />
            every class, since 2015.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every ranking is built position-by-position first — boards stay open after the draft too, so you can
            look back on how a class actually played out.
          </p>
        </div>

        <div className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">By Position</p>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {POSITIONS.map((pos) => (
              <a key={pos.abbr} href={pos.href} className="block">
                <CornerFrame className="flex h-full flex-col justify-between transition-transform duration-200 hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <span className="font-headline text-5xl leading-none text-ink transition-colors duration-200 group-hover:text-accent sm:text-6xl">
                      {pos.abbr}
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-ink-tertiary transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
                  </div>
                  <span className="mt-8 text-sm font-medium text-ink-secondary">{pos.label}</span>
                </CornerFrame>
              </a>
            ))}
          </div>
        </div>

        {years.length > 0 && (
          <div className="mt-10">
            <p className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">By Class Year</p>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {years.map((year) => {
                const count = counts.get(year) ?? 0;
                return (
                  <Link key={year} href={`/classes/${year}`} className="block">
                    <CornerFrame className="flex h-full flex-col justify-between transition-transform duration-200 hover:-translate-y-1">
                      <span className="font-headline text-4xl leading-none text-ink transition-colors duration-200 group-hover:text-accent sm:text-5xl">
                        {year}
                      </span>
                      <Badge tone="outline" className="mt-6 w-fit">
                        {count > 0 ? `${count} prospects` : "Early Look"}
                      </Badge>
                    </CornerFrame>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
