import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { CornerFrame } from "@/components/ui/CornerFrame";

const POSITIONS = [
  { abbr: "QB", label: "Quarterbacks", href: "/positions/qb" },
  { abbr: "RB", label: "Running Backs", href: "/positions/rb" },
  { abbr: "WR", label: "Wide Receivers", href: "/positions/wr" },
  { abbr: "TE", label: "Tight Ends", href: "/positions/te" },
];

export function PositionNav() {
  return (
    <section id="positions" className="border-b border-border bg-void py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
            Browse by Position
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
            Start at the position.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Every ranking is built position-by-position first, then rolled
            up into the big board.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {POSITIONS.map((pos) => (
            <a key={pos.abbr} href={pos.href} className="block">
              <CornerFrame className="flex h-full flex-col justify-between transition-transform duration-200 hover:-translate-y-1">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-4xl font-semibold text-ink transition-colors duration-200 group-hover:text-accent sm:text-5xl">
                    {pos.abbr}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-ink-tertiary transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
                </div>
                <span className="mt-8 text-sm font-medium text-ink-secondary">
                  {pos.label}
                </span>
              </CornerFrame>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
