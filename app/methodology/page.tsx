"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, ChevronDown } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { POSITION_SUBSCORES, METHODOLOGY_POSITIONS, subScoreSlug } from "@/lib/methodologySlugs";
import { cn } from "@/lib/utils";

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
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tightest text-ink sm:text-5xl">
            How the grades work.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
            A position-by-position breakdown of the grading model — what
            each score measures and how it&apos;s calculated.
          </p>
          <Badge tone="accent" className="mt-8">
            In development
          </Badge>
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
                <h2 className="font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                  {positionLabel}
                </h2>
                <p className="mt-3 max-w-2xl text-sm italic leading-relaxed text-ink-tertiary">
                  Placeholder — a description of how {positionLabel.toLowerCase()} are
                  evaluated goes here.
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
                            <p className="max-w-2xl text-sm italic leading-relaxed text-ink-tertiary">
                              Placeholder — a description of the {label} score for{" "}
                              {positionLabel.toLowerCase()} goes here.
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
