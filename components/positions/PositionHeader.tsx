import { Container } from "@/components/layout/Container";
import type { PositionTheme } from "@/lib/positionThemes";

/**
 * Purely static — position code, name, philosophy line. No prospect
 * count or stats here anymore (that used to live in a separate 2x2
 * grid below, plus a duplicate count badge in this header). Numbers
 * that depend on league format now live entirely in
 * PositionRankingsWithChart, which already owns the shared format
 * state — keeping a second, server-rendered "count" here would risk
 * the exact static-vs-live mismatch already fixed once on the Class
 * page's tier distribution.
 */
export function PositionHeader({ theme }: { theme: PositionTheme }) {
  return (
    <section className="border-b border-border bg-grid-columns">
      <Container className="flex items-start gap-5 py-10 sm:py-12">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center border font-mono text-2xl font-semibold sm:h-20 sm:w-20 sm:text-3xl"
          style={{
            borderColor: `${theme.accent}4D`,
            backgroundColor: `${theme.accent}1A`,
            color: theme.accent,
          }}
        >
          {theme.code}
        </span>
        <div>
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
        </div>
      </Container>
    </section>
  );
}
