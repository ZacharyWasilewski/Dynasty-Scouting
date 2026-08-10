"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScoreRing({
  label,
  value,
  text,
  size = 128,
  accent = false,
  color,
  decimals = 1,
  infoHref,
  info,
}: {
  label: string;
  value?: number;
  text?: string;
  size?: number;
  accent?: boolean;
  color?: string;
  decimals?: number;
  /** Popup gets a highlighted "Learn more" link out to this URL (e.g. a methodology section). */
  infoHref?: string;
  /** Popup's description text. Falls back to generic placeholder text if omitted but infoHref is set. */
  info?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const hasInfo = Boolean(info || infoHref);
  const popupText = info ?? `Placeholder — a description of the ${label} score goes here.`;

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
  const labelSizeClass = size < 100 ? "text-[10px] tracking-wide" : "text-xs tracking-widest2";
  const hasContent = value !== undefined || isText;
  const infoIconSize = size < 100 ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#232830"
            strokeWidth={stroke}
          />
          {hasContent && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color ?? (accent ? "#3B82F6" : "#9BA3AF")}
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
              "font-mono font-semibold transition-opacity duration-500",
              fontSizeClass,
              hasContent ? "text-ink" : "text-ink-tertiary",
              mounted ? "opacity-100" : "opacity-0"
            )}
          >
            {isText ? text : value !== undefined ? value.toFixed(decimals) : "—"}
          </span>
        </div>

        {hasInfo && (
          <button
            onClick={() => setShowPopup(true)}
            aria-label={`About ${label}`}
            className="absolute -right-2 -top-2 flex items-center justify-center text-ink-tertiary transition-colors duration-150 hover:text-accent"
          >
            <Info className={infoIconSize} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <span className={cn("whitespace-nowrap text-center font-mono uppercase text-ink-tertiary", labelSizeClass)}>
        {label}
      </span>

      {hasInfo && showPopup && (
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
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">{label}</span>
            <p className="mt-3 text-sm italic leading-relaxed text-ink-secondary">{popupText}</p>
            {infoHref && (
              <Link
                href={infoHref}
                className="mt-5 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-accent transition-colors duration-150 hover:bg-accent/20"
              >
                Learn more
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
