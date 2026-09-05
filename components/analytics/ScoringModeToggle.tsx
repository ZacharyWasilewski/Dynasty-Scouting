"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, X, ArrowRight } from "@/components/ui/SiteIcons";
import { useScoringMode } from "@/components/analytics/ScoringModeContext";

function ScoringModeInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About Standard vs. Weighted scoring"
        className="inline-flex items-center justify-center text-ink-tertiary transition-colors hover:text-accent"
      >
        <Info className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-void/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md border border-border-strong bg-surface p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-ink-tertiary transition-colors hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                Standard vs. Weighted
              </span>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Weighted hit rates are calculated by assigning values to
                player quality based on their fantasy football positional
                finishes.
              </p>
            </div>

            <Link
              href="/methodology#weighted-hit-rates"
              className="mt-5 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-accent transition-colors duration-150 hover:bg-accent/20"
            >
              Learn more
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

export function ScoringModeToggle() {
  const { mode, setMode } = useScoringMode();

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setMode("standard")}
          aria-pressed={mode === "standard"}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors duration-150 ${
            mode === "standard" ? "bg-accent text-void" : "text-ink-tertiary hover:text-ink-secondary"
          }`}
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => setMode("weighted")}
          aria-pressed={mode === "weighted"}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors duration-150 ${
            mode === "weighted" ? "bg-accent text-void" : "text-ink-tertiary hover:text-ink-secondary"
          }`}
        >
          Weighted
        </button>
      </div>
      <ScoringModeInfo />
    </div>
  );
}
