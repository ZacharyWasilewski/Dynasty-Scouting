import { Container } from "@/components/layout/Container";
import type { PositionTheme } from "@/lib/positionThemes";

/**
 * Purely static — position name, philosophy line. No prospect count
 * or stats here anymore (that used to live in a separate 2x2 grid
 * below, plus a duplicate count badge in this header). Numbers that
 * depend on league format now live entirely in
 * PositionRankingsWithChart, which already owns the shared format
 * state — keeping a second, server-rendered "count" here would risk
 * the exact static-vs-live mismatch already fixed once on the Class
 * page's tier distribution. The colored position-code box that used
 * to sit here (a bordered square with "RB"/"QB"/etc inside) was
 * removed entirely — it was redundant with the title itself
 * ("Running Backs" already says what position this is) and read as
 * a generic dashboard-icon-chip rather than anything meaningful.
 */
export function PositionHeader({ theme }: { theme: PositionTheme }) {
  return (
    <section className="border-b border-border bg-grid-columns">
      <Container className="py-10 sm:py-12">
        <span
          className="font-mono text-xs uppercase tracking-widest2"
          style={{ color: theme.accent }}
        >
          Position Group
        </span>
        <h1 className="mt-1 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
          {theme.label}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
          {theme.description}
        </p>
      </Container>
    </section>
  );
}
