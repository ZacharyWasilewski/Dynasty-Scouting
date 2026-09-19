"use client";

import { useState } from "react";
import { DialogSurface } from "@/components/ui/DialogSurface";
import { Info, X } from "@/components/ui/SiteIcons";

export function TierHitRateInfo({ stage, position, tier, format, count }: {
  stage: string; position: string; tier?: string; format: string; count: number;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label="About this tier hit rate" aria-haspopup="dialog" onClick={() => setOpen(true)}
      className="-m-2 inline-flex shrink-0 items-center justify-center p-2 text-ink-tertiary hover:text-accent">
      <Info className="h-3 w-3" />
    </button>
    {open && <DialogSurface onClose={() => setOpen(false)} aria-label="About this tier hit rate" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-md max-h-[85dvh] overflow-y-auto border border-border-strong bg-surface p-6 shadow-xl">
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-2 top-2 p-3 text-ink-tertiary"><X className="h-5 w-5" /></button>
        <h2 className="pr-8 font-headline text-xl text-ink">{stage} Tier Hit Rate</h2>
        <p className="mt-3 text-sm text-ink-secondary">Historical {position} prospects in the {tier ?? "selected"} tier using {stage} scores and {format} scoring.</p>
        <p className="mt-3 text-sm text-ink-secondary">HIT ÷ (HIT + MISS). A 1YS outcome or better is a hit; Bench and Bust are misses. RP pushes and unresolved outcomes are excluded.</p>
        <p className="mt-3 text-sm text-ink-secondary">{count > 0 ? `${count} resolved prospects in this sample.${count < 10 ? " Small sample: the rate can change substantially with one result." : ""}` : "No resolved sample is available."} This is a historical group rate, not an individual player’s probability of success.</p>
      </div>
    </DialogSurface>}
  </>;
}
