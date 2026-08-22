import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { SearchBar } from "@/components/home/SearchBar";
import { getTierForScore, getTierColor } from "@/lib/tiers";
import { getDisplayedPreDraftScore } from "@/lib/prospects";
import type { Prospect } from "@/types/prospect";

/**
 * The Navbar (mounted globally, above this on every page) already
 * shows the logo mark — this doesn't need to repeat a full lockup to
 * "keep the logo," just stay recognizably branded. That frees this
 * section up to lead with the thing that actually differentiates the
 * product: a graded number, treated as the hero's real visual
 * centerpiece rather than tucked into a card further down the page.
 * The score panel shows the actual highest grade currently on record
 * anywhere in the database — not a placeholder "100" (an earlier
 * version of this hardcoded that, and it read as hollow precisely
 * because it wasn't real) — and links straight to that player, so
 * it's a real fact and a real destination, not decoration standing
 * in for one.
 */
export function Hero({ prospects }: { prospects: Prospect[] }) {
  const topGraded = [...prospects]
    .map((p) => ({ prospect: p, score: p.hasDraftData === true ? p.ddScore1QB : getDisplayedPreDraftScore(p) }))
    .filter((x): x is { prospect: Prospect; score: number } => x.score !== undefined)
    .sort((a, b) => b.score - a.score)[0];
  const topTier = topGraded ? getTierForScore(topGraded.score) : undefined;
  // A real hex value, not a CSS variable reference — needed because
  // this gets used below with a hex alpha-suffix trick (`${topColor}99`
  // for a translucent border), which only works on an actual hex
  // string. Matches the light theme's own accent color exactly
  // (see :root in globals.css) rather than the old dark theme's blue.
  const topColor = topTier ? getTierColor(topTier) : "#2563EB";

  return (
    <section className="relative overflow-hidden border-b border-border bg-void bg-rule-lines">
      {/* Mobile's own version of the data-as-imagery moment — not
          the full bordered score panel (there's no room to put that
          beside the headline at phone width without cramping both),
          just a big ghost numeral sitting behind the text as
          texture. Purely decorative and behind the content
          (pointer-events-none, negative z-index), so there's no risk
          of it interfering with the actual, interactive hero content
          in front of it. */}
      {topGraded && (
        <div
          className="pointer-events-none absolute -right-16 -top-10 select-none font-headline text-[220px] leading-none text-ink opacity-[0.04] lg:hidden"
        >
          {Math.round(topGraded.score)}
        </div>
      )}
      <Container className="relative grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-6 lg:py-24">
        <div className="animate-fade-in-up [animation-delay:0ms]">
          {/* The wordmark that used to sit here was removed — it
              was a second, isolated logo appearance directly below
              the Navbar's own logo mark just above it (same page,
              same viewport, no scroll between them), small and
              disconnected on its own rather than reinforcing
              anything. The Navbar already establishes the brand on
              every page; this section can lead straight into the
              actual content instead. */}
          <Badge tone="outline" className="animate-fade-in-up [animation-delay:0ms]">
            2027 Draft Cycle · In Progress
          </Badge>

          {/* Rewritten from an earlier version that leaned on
              wordplay ("Grade the whole class") — this states the
              actual mechanic plainly instead: many different
              players, one comparable scale. */}
          <h1 className="mt-4 animate-fade-in-up font-headline text-4xl uppercase leading-[0.9] tracking-tight text-ink [animation-delay:120ms] sm:text-6xl lg:text-7xl xl:text-8xl">
            Every prospect.
            <br />
            <span className="text-accent">One score.</span>
          </h1>

          <p className="mt-6 max-w-md animate-fade-in-up text-lg leading-relaxed text-ink-secondary [animation-delay:200ms]">
            Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie
            since 2015.
          </p>

          <div className="mt-8 max-w-xl animate-fade-in-up [animation-delay:260ms]">
            <SearchBar />
          </div>
        </div>

        {/* Hidden below lg rather than just shrunk — at phone width
            this composition doesn't work as a side-by-side, so it's
            simply not part of the mobile hero at all, rather than
            forcing a desktop layout into a column it wasn't designed
            for. */}
        {topGraded && topTier && (
          <div className="relative hidden h-full min-h-[420px] items-center justify-center lg:flex">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-headline text-[340px] leading-none text-ink opacity-[0.05]">
                {Math.round(topGraded.score)}
              </span>
            </div>
            <Link
              href={`/players/${topGraded.prospect.id}`}
              prefetch={false}
              className="group relative border-2 bg-void/60 px-10 py-8 backdrop-blur-sm transition-colors duration-200 hover:bg-void/80"
              style={{ borderColor: `${topColor}99` }}
            >
              <span className="absolute -left-[3px] -top-[3px] h-6 w-6 border-l-2 border-t-2" style={{ borderColor: topColor }} />
              <span className="absolute -right-[3px] -top-[3px] h-6 w-6 border-r-2 border-t-2" style={{ borderColor: topColor }} />
              <span className="absolute -bottom-[3px] -left-[3px] h-6 w-6 border-b-2 border-l-2" style={{ borderColor: topColor }} />
              <span className="absolute -bottom-[3px] -right-[3px] h-6 w-6 border-b-2 border-r-2" style={{ borderColor: topColor }} />
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                Highest Grade on Record
              </p>
              <p className="mt-2 font-headline text-7xl leading-none text-ink">{topGraded.score.toFixed(1)}</p>
              {/* A plain 0–100 scale, not a gradient — a visitor's
                  very first moment on the site shouldn't assume they
                  already know what "100" or "Generational" means.
                  The marker's position alone makes the scale and the
                  score's place on it immediately legible; no color
                  fill needed to make that point. */}
              <div className="relative mt-4 h-px w-full bg-border-strong">
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${topGraded.score}%`, backgroundColor: topColor }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-ink-tertiary">
                <span>0</span>
                <span>100</span>
              </div>
              <p className="mt-3 truncate font-mono text-xs uppercase tracking-widest2" style={{ color: topColor }}>
                {topGraded.prospect.name} · {topTier}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-tertiary">
                {topTier === "Generational"
                  ? "Our rarest grade — only a handful of prospects ever reach it."
                  : `The highest grade currently on record, out of 100.`}
              </p>
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
