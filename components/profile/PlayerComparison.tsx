"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Users, User } from "lucide-react";
import { isResolved } from "@/lib/similarProspects";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import { getTierColor, getTierForScore } from "@/lib/tiers";
import { getGlobalFormat } from "@/lib/globalFormat";
import { getDDScore, getDDTier, type LeagueFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";

/** Small circular headshot for a comparison row — undrafted
 *  prospects don't have a real photo (see lib/playerPhotos.ts), so
 *  this falls back to the same generic silhouette used everywhere
 *  else on the site rather than leaving a blank gap. */
function ComparisonThumb({ prospect, size }: { prospect: Prospect; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface-raised"
      style={{ width: size, height: size }}
    >
      {prospect.photoUrl ? (
        <Image
          src={prospect.photoUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <User className="h-1/2 w-1/2 text-ink-tertiary" strokeWidth={1.5} />
      )}
    </div>
  );
}

export function PlayerComparison({
  current,
  similar,
}: {
  current: Prospect;
  similar: Prospect[];
}) {
  const [comparing, setComparing] = useState<Prospect | null>(null);
  const currentResolved = isResolved(current);
  // Same bug and same fix as ComparisonPanel — this list previously
  // always showed p.ddScore (the static base field), never actually
  // respecting the site's 1QB/Superflex/TEP toggle.
  const [format, setFormat] = useState<LeagueFormat>("1QB");
  useEffect(() => {
    setFormat(getGlobalFormat());
  }, []);

  if (similar.length === 0) return null;

  // Redundant with the `if (similar.length === 0) return null` above
  // (guarantees at least one entry), but noUncheckedIndexedAccess
  // means TS can't infer that through array destructuring — this is
  // the exact same class of bug that shipped once already this
  // session (an unguarded destructure from a known-non-empty array).
  const [featured, ...rest] = similar;
  if (!featured) return null;
  const featuredTier = currentResolved
    ? getDDTier(featured, format)
    : getTierForScore(featured.preDraftScore);

  return (
    <div>
      {/* The closest match gets real visual emphasis — a full-width
          row of its own, not just first-in-a-grid — while the
          remaining matches stay compact underneath. All three were
          previously treated identically, which doesn't actually
          communicate that this is a ranked list. */}
      {featured && (
        <button
          onClick={() => setComparing(featured)}
          className="group flex w-full items-center justify-between gap-4 border border-border-strong bg-surface p-5 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-surface-raised"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ComparisonThumb prospect={featured} size={48} />
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-accent">Closest Match</span>
              <p className="mt-1 truncate font-headline text-xl uppercase leading-tight text-ink group-hover:text-accent">
                {featured.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
                <SchoolLogo url={featured.schoolLogoUrl} size={12} /> {featured.school ?? "—"} ·{" "}
                {featured.draftClass ?? "—"}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 font-headline text-3xl leading-none"
            style={{ color: featuredTier ? getTierColor(featuredTier) : undefined }}
          >
            {(currentResolved ? getDDScore(featured, format) : featured.preDraftScore)?.toFixed(1) ?? "—"}
          </span>
        </button>
      )}

      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rest.map((p) => {
          // Score shown here matches the modal: DD Score for drafted
          // players, or Pre-Draft Score for an undrafted current player.
          const score = currentResolved ? getDDScore(p, format) : p.preDraftScore;
          // Tier-colored, matching the same treatment the profile
          // page and rankings tables already use for a score — this
          // was previously plain gray text, an inconsistency with
          // the rest of the site's established score presentation.
          const rowTier = currentResolved ? getDDTier(p, format) : getTierForScore(p.preDraftScore);
          return (
            <button
              key={p.id}
              onClick={() => setComparing(p)}
              className="group flex items-center justify-between gap-3 border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-surface-raised"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ComparisonThumb prospect={p} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink group-hover:text-accent">{p.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
                    <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school ?? "—"} · {p.draftClass ?? "—"}
                  </p>
                </div>
              </div>
              <span
                className="shrink-0 font-mono text-sm font-semibold"
                style={{ color: rowTier ? getTierColor(rowTier) : undefined }}
              >
                {score?.toFixed(1) ?? "—"}
              </span>
            </button>
          );
        })}
        </div>
      )}

      {comparing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={() => setComparing(null)} />
          <div className="relative z-10 w-full max-w-lg border border-border-strong bg-surface p-6 shadow-xl sm:p-8">
            <button
              onClick={() => setComparing(null)}
              className="absolute right-4 top-4 text-ink-tertiary transition-colors duration-150 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-accent">
              <Users className="h-4 w-4" strokeWidth={1.75} />
              <span className="font-mono text-xs uppercase tracking-widest2">Comparison</span>
            </div>

            <div className="mt-4">
              <ComparisonPanel current={current} other={comparing} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
