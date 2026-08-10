"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The primary grade, presented as typography rather than a ring —
 * the number itself should read as the dominant element on a player
 * page before anything else. Keeps the same info-popup affordance
 * ScoreRing has elsewhere, just without the circular chrome.
 */
export function GradeDisplay({
  label,
  value,
  tierLabel,
  color,
  info,
}: {
  label: string;
  value?: number;
  tierLabel?: string;
  color?: string;
  info?: string;
}) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <div className="relative inline-flex flex-col">
      <div className="flex items-start gap-2">
        <span
          className="font-display text-6xl font-bold leading-none tracking-tightest sm:text-7xl"
          style={{ color: color ?? undefined }}
        >
          {value !== undefined ? value.toFixed(1) : "—"}
        </span>
        {info && (
          <button
            onClick={() => setShowPopup(true)}
            aria-label={`About ${label}`}
            className="mt-1 flex items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-accent"
          >
            <Info className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
          {label}
        </span>
        {tierLabel && (
          <>
            <span className="text-ink-tertiary">·</span>
            <span
              className="font-mono text-xs font-semibold uppercase tracking-widest2"
              style={{ color: color ?? undefined }}
            >
              {tierLabel}
            </span>
          </>
        )}
      </div>

      {info && showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={() => setShowPopup(false)} />
          <div className="relative z-10 w-full max-w-sm border border-border-strong bg-surface p-6 shadow-xl">
            <button
              onClick={() => setShowPopup(false)}
              className="absolute right-4 top-4 text-ink-tertiary transition-colors duration-150 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <span className={cn("font-mono text-xs uppercase tracking-widest2 text-accent")}>{label}</span>
            <p className="mt-3 text-sm italic leading-relaxed text-ink-secondary">{info}</p>
          </div>
        </div>
      )}
    </div>
  );
}
