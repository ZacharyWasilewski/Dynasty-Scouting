import Link from "next/link";
import { TrendingUp, TrendingDown } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import type { ScoreMover } from "@/lib/trending";

function MoverRow({ mover, positive }: { mover: ScoreMover; positive: boolean }) {
  return (
    <Link
      href={`/players/${mover.id}`}
      prefetch={false}
      className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 transition-colors duration-150 first:border-t-0 hover:bg-surface-raised active:bg-surface-raised"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{mover.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
          {mover.position}
          {mover.school && (
            <>
              · <SchoolLogo url={mover.schoolLogoUrl} size={12} /> {mover.school}
            </>
          )}
        </p>
      </div>
      {/* The movement itself as the visual weight — font-headline
          rather than mono, giving it real presence instead of
          reading as a small stat label next to the name. */}
      <span className={`shrink-0 font-headline text-2xl leading-none ${positive ? "text-riser" : "text-faller"}`}>
        {positive ? "+" : ""}
        {mover.delta.toFixed(1)}
      </span>
    </Link>
  );
}

export function Trending({ risers, fallers }: { risers: ScoreMover[]; fallers: ScoreMover[] }) {
  const hasMovers = risers.length > 0 || fallers.length > 0;

  return (
    <section className={`border-b border-border bg-surface ${hasMovers ? "py-24" : "py-14"}`}>
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Pre-Draft Movers</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Trending
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            Pre-Draft Score movement for devy prospects, a sheet update, a new data point, or a re-grade.
          </p>
        </div>

        {!hasMovers ? (
          // Rather than hiding the section entirely (indistinguishable
          // from "broken" to anyone looking for it), say plainly why
          // it's empty — no baseline yet, or genuinely nobody's score
          // has moved since the last one. Reduced section padding
          // (py-14 vs. the full py-24) so this doesn't hold as much
          // homepage real estate as the populated version would.
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm text-ink-tertiary">
              No movement recorded since the last update yet. The board updates when new data changes a
              prospect&apos;s grade.
            </p>
            <Link href="/players" className="shrink-0 font-mono text-xs uppercase tracking-widest2 text-accent hover:underline">
              See the current board →
            </Link>
          </div>
        ) : (
          <div className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
            {risers.length > 0 && (
              <div className="border border-border bg-void">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <TrendingUp className="h-4 w-4 text-riser" strokeWidth={1.75} />
                  <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">Risers</span>
                </div>
                {risers.map((m) => (
                  <MoverRow key={m.id} mover={m} positive />
                ))}
              </div>
            )}
            {fallers.length > 0 && (
              <div className="border border-border bg-void">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <TrendingDown className="h-4 w-4 text-faller" strokeWidth={1.75} />
                  <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">Fallers</span>
                </div>
                {fallers.map((m) => (
                  <MoverRow key={m.id} mover={m} positive={false} />
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
