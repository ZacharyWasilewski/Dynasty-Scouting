"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { getTierColor } from "@/lib/tiers";
import type { Tier } from "@/types/prospect";

const RANGES: { tier: Tier; range: string }[] = [
  { tier: "Generational", range: "95–100" },
  { tier: "Elite", range: "90–94.9" },
  { tier: "Starter", range: "85–89.9" },
  { tier: "Flex", range: "80–84.9" },
  { tier: "Upside Shot", range: "75–79.9" },
  { tier: "Bench", range: "70–74.9" },
  { tier: "Taxi Squad", range: "60–69.9" },
  { tier: "Roster Clogger", range: "0–59.9" },
];

export function PositionalTierHitRateInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About Positional Tier Hit Rates"
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
                Positional Tier Hit Rates
              </span>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Positional Tier Hit Rates are calculated using player&apos;s Positional Scores in a 1QB non TEP league.
              </p>
            </div>

            <div className="mt-6 overflow-hidden border border-border">
              <div className="grid grid-cols-[1fr_auto] bg-surface-raised px-4 py-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">
                <span>Tier</span>
                <span>Positional Score</span>
              </div>
              {RANGES.map(({ tier, range }) => (
                <div key={tier} className="grid grid-cols-[1fr_auto] items-center border-t border-border px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: getTierColor(tier) }}
                    />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink">
                      {tier}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-ink-secondary">{range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
