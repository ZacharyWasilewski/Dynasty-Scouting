import { Container } from "@/components/layout/Container";
import type { PositionTheme } from "@/lib/positionThemes";

export function PositionHeader({
  theme,
  count,
}: {
  theme: PositionTheme;
  count: number;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-grid-columns">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 15% 0%, ${theme.accent}22, transparent)`,
        }}
      />
      <Container className="relative flex flex-col gap-8 py-14 sm:flex-row sm:items-end sm:justify-between lg:py-20">
        <div className="flex items-start gap-5">
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
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tightest text-ink sm:text-5xl">
              {theme.label}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
              {theme.description}
            </p>
          </div>
        </div>

        <span
          className="inline-flex w-fit shrink-0 items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest2"
          style={{
            borderColor: `${theme.accent}4D`,
            color: theme.accent,
          }}
        >
          {count} {count === 1 ? "prospect" : "prospects"} graded
        </span>
      </Container>
    </section>
  );
}
