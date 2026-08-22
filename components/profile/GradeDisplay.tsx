"use client";

import { useEffect, useRef, useState } from "react";
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
  text,
  tierLabel,
  color,
  info,
}: {
  label: string;
  value?: number;
  text?: string;
  tierLabel?: string;
  color?: string;
  info?: string;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const isPerfect = value === 100 && tierLabel === "Generational";

  useEffect(() => {
    const from = previousValue.current;
    previousValue.current = value;

    if (value === undefined || from === undefined || from === value) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 550;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="relative inline-flex flex-col">
      <div className="flex items-start gap-2">
        <span
          className="font-headline text-6xl leading-none sm:text-7xl"
          style={{
            color: color ?? undefined,
            textShadow: isPerfect
              ? "0 0 0 #FACC15, 1px 1px 0 #FACC15, -1px -1px 0 #FACC15, 1px -1px 0 #FACC15, -1px 1px 0 #FACC15"
              : undefined,
          }}
        >
          {text ?? (displayValue !== undefined ? displayValue.toFixed(1) : "—")}
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
      </div>
      {/* Tier name as its own clear line — tierLabel was already
          being passed in, but only ever used internally to detect a
          perfect score, never actually shown. The brief's own
          intended hierarchy is explicit: the number, then the label,
          then the tier — three lines, not two. */}
      {tierLabel && (
        <span
          className="mt-0.5 font-headline text-sm uppercase leading-none tracking-tight"
          style={{ color: color ?? undefined }}
        >
          {tierLabel}
        </span>
      )}

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
