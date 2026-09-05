"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, ChevronDown } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { POSITION_SUBSCORES, METHODOLOGY_POSITIONS, subScoreSlug, subScoreDescription } from "@/lib/methodologySlugs";
import { getPositionTheme } from "@/lib/positionThemes";
import { FINISH_WEIGHTS } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { CalibrationExplainer } from "@/components/analytics/CalibrationExplainer";

const FINISH_ORDER: { key: keyof typeof FINISH_WEIGHTS; label: string }[] = [
  { key: "superstar", label: "SuperStar" },
  { key: "stud", label: "Stud" },
  { key: "mys", label: "MYS" },
  { key: "1ys", label: "1YS" },
  { key: "rp", label: "RP" },
  { key: "bench", label: "Bench" },
  { key: "bust", label: "Bust" },
];

const POSITION_LABELS: Record<string, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
};

export default function MethodologyPage() {
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());
  const hasHandledHash = useRef(false);

  useEffect(() => {
    if (hasHandledHash.current) return;
    hasHandledHash.current = true;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    setOpenSlugs((prev) => new Set(prev).add(hash));
    // Give the section a moment to render/expand before scrolling.
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  function toggle(slug: string) {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col items-start py-20 lg:py-24">
          <span className="flex h-12 w-12 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <Compass className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="mt-6 font-mono text-xs uppercase tracking-widest2 text-accent">
            Methodology
          </span>
          <h1 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
            How the grades work.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
            A position-by-position breakdown of the grading model, what
            each score measures and how it&apos;s calculated.
          </p>
        </Container>
      </section>

      {/* Moved here from the Analytics page, on request — this is
          genuinely "how the grades work" content (the same real
          per-stage descriptions already shown on every player
          profile), not performance/validation data, so it belongs on
          Methodology, not Analytics. Placed before the weighted-vs-
          standard hit rate detail below, since understanding the
          four score stages conceptually is the more fundamental,
          logically-prior piece. */}
      <section className="border-b border-border py-14">
        <Container>
          <CalibrationExplainer />
        </Container>
      </section>

      <section id="weighted-hit-rates" className="scroll-mt-24 border-b border-border py-14">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              Analytics
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
              Weighted vs. Standard Hit Rates
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              <span className="font-semibold text-ink">Standard: </span>
              This is calculated by weighting the different metrics for
              each position. Each metric is based on the best season of a
              player&apos;s college career, and within each metric there
              is a tiering system to assign values to a player&apos;s
              score. Weighting and tier systems have been adjusted over
              time and will continue to be adjusted to create a
              well-balanced tier hit rate within the model.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              <span className="font-semibold text-ink">Weighted: </span>
              The weighted hit rate is based directly on our standard
              system, but with a slight tweak. Players are assigned a
              career outcome based on their fantasy football finishes
              (you can check a player&apos;s career outcome just below the
              Dynasty Database Score on their player profile). This
              outcome is then assigned a weight depending on how they
              impacted your fantasy football team; this weight is then
              applied to a simple hit rate calculation in order to
              provide a hit rate system that isn&apos;t just based on a
              binary hit-or-miss system.
            </p>
          </div>

          <div className="mt-6 max-w-md overflow-hidden border border-border">
            <div className="grid grid-cols-[1fr_auto] bg-surface-raised px-4 py-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">
              <span>Finish</span>
              <span>Weight</span>
            </div>
            {FINISH_ORDER.map(({ key, label }) => (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto] items-center border-t border-border px-4 py-2.5"
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink">
                  {label}
                </span>
                <span className="font-mono text-[10px] text-ink-secondary">
                  {((FINISH_WEIGHTS[key] ?? 0) / 100).toFixed(2)}
                  {key === "rp" ? " (push)" : ""}
                </span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="flex flex-col gap-16">
            {METHODOLOGY_POSITIONS.map((position) => {
              const positionLabel = POSITION_LABELS[position] ?? position;
              const subscores = POSITION_SUBSCORES[position] ?? [];
              return (
              <div key={position}>
                <div className="flex items-baseline gap-4">
                  <span className="font-headline text-5xl leading-none text-accent sm:text-6xl">{position}</span>
                  <h2 className="font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                    {positionLabel}
                  </h2>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">
                  {getPositionTheme(position.toLowerCase())?.description ??
                    `A position-by-position breakdown for ${positionLabel.toLowerCase()} is on the way.`}
                </p>

                <div className="mt-6 flex flex-col divide-y divide-border border-y border-border">
                  {subscores.map((label) => {
                    const slug = subScoreSlug(position, label);
                    const isOpen = openSlugs.has(slug);
                    return (
                      <div key={slug} id={slug} className="scroll-mt-24">
                        <button
                          onClick={() => toggle(slug)}
                          className="flex w-full items-center justify-between gap-4 py-4 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="font-mono text-sm font-semibold uppercase tracking-wide text-ink">
                            {label}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-ink-tertiary transition-transform duration-200",
                              isOpen && "rotate-180"
                            )}
                          />
                        </button>
                        {isOpen && (
                          <div className="pb-5">
                            <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
                              {subScoreDescription(position, label)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </Container>
      </section>
    </main>
  );
}
