"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Info, X, ArrowRight } from "@/components/ui/SiteIcons";
import { cn } from "@/lib/utils";

export function ScoreRing({
  label,
  value,
  text,
  size = 128,
  accent = false,
  color,
  decimals = 1,
  /** Appended after the numeric value only (e.g. "%") — never
   *  applies in text mode, and every existing caller omits this, so
   *  nothing renders differently unless a caller opts in. */
  suffix = "",
  infoHref,
  info,
  infoPosition = "ring",
}: {
  label: string;
  value?: number;
  text?: string;
  size?: number;
  accent?: boolean;
  color?: string;
  decimals?: number;
  suffix?: string;
  /** Popup gets a highlighted "Learn more" link out to this URL (e.g. a methodology section). */
  infoHref?: string;
  /** Popup's description text. Falls back to generic placeholder text if omitted but infoHref is set. */
  info?: string;
  /** Place the trigger beside the label when a compact layout needs cleaner ring spacing. */
  infoPosition?: "ring" | "label";
}) {
  const [mounted, setMounted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // Backdrop-click and the explicit close button both already
  // dismissed this — Escape didn't, which is the one dismissal path
  // a keyboard user actually has for a role="dialog" with no other
  // focusable content behind it.
  useEffect(() => {
    if (!showPopup) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPopup(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showPopup]);
  const hasInfo = Boolean(info || infoHref);
  const popupText = info ?? `Placeholder, a description of the ${label} score goes here.`;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const stroke = size < 100 ? 4 : 6;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const isText = text !== undefined;
  const pct = isText ? 100 : Math.max(0, Math.min(100, value ?? 0));
  const offset = circumference - ((mounted ? pct : 0) / 100) * circumference;
  const fontSizeClass = size < 100 ? (isText ? "text-sm" : "text-lg") : isText ? "text-xl" : "text-3xl";
  const labelSizeClass = size < 100 ? "max-w-[64px] text-[8px] leading-tight tracking-wide" : "text-xs tracking-widest2";
  const hasContent = value !== undefined || isText;
  const infoIconSize = size < 100 ? "h-4 w-4" : "h-5 w-5";
  // Fixed at ~19% of the default 128px ring; scaling this with size keeps
  // the icon tucked against the ring's corner at any size instead of
  // visually detaching on small rings (e.g. the 48px ones in Mock Draft).
  // Small rings get a few extra px of clearance on top of that —
  // the icon itself doesn't shrink as much as the ring does at small
  // sizes (still h-4 w-4), so the plain percentage alone left it
  // crowding the score text inside 48px rings specifically.
  const infoOffset = -Math.round(size * 0.19) - (size < 100 ? 3 : 0);
  const isPerfect = value === 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow: isPerfect ? "0 0 0 1.5px #FACC15" : undefined,
        }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
          />
          {hasContent && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color ?? (accent ? "var(--color-accent)" : "var(--color-ink-secondary)")}
              strokeWidth={stroke}
              strokeLinecap={isText ? "butt" : "round"}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums transition-opacity duration-500",
              fontSizeClass,
              hasContent ? "text-ink" : "text-ink-tertiary",
              mounted ? "opacity-100" : "opacity-0"
            )}
          >
            {isText ? text : value !== undefined ? `${value.toFixed(decimals)}${suffix}` : "—"}
          </span>
        </div>

        {hasInfo && infoPosition === "ring" && (
          <button
            onClick={() => setShowPopup(true)}
            aria-label={`About ${label}`}
            style={{ right: infoOffset, top: infoOffset }}
            className="absolute flex items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-accent"
          >
            <Info className={infoIconSize} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-center gap-1">
        <span className={cn("text-center font-mono uppercase text-ink-tertiary", size < 100 ? "whitespace-normal" : "whitespace-nowrap", labelSizeClass)}>
          {label}
        </span>
        {hasInfo && infoPosition === "label" && (
          <button
            onClick={() => setShowPopup(true)}
            aria-label={`About ${label}`}
            className="shrink-0 text-ink-tertiary transition-colors duration-150 hover:text-accent"
          >
            <Info className={size < 100 ? "h-3 w-3" : "h-4 w-4"} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {hasInfo && showPopup && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`About ${label}`}>
          <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={() => setShowPopup(false)} />
          <div className="relative z-10 w-full max-w-sm border border-border-strong bg-surface p-6 shadow-xl">
            <button
              onClick={() => setShowPopup(false)}
              className="absolute right-4 top-4 text-ink-tertiary transition-colors duration-150 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="font-tech text-xs uppercase tracking-widest2 text-accent">{label}</span>
            <p className="mt-3 text-sm italic leading-relaxed text-ink-secondary">{popupText}</p>
            {infoHref && (
              <Link
                href={infoHref}
                className="mt-5 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-4 py-2 font-tech text-xs font-semibold uppercase tracking-wide text-accent transition-colors duration-150 hover:bg-accent/20"
              >
                Learn more
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
