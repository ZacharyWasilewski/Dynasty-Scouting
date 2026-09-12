"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isResolved } from "@/lib/similarProspects";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getGlobalFormat } from "@/lib/globalFormat";
import { getDDScore, type LeagueFormat } from "@/lib/ddScore";
import { applyFormatAdjustment } from "@/lib/formatAdjustment";
import { playerHref } from "@/lib/playerLinks";
import type { Prospect } from "@/types/prospect";

export function ComparisonPanel({
  current,
  other,
  format: formatOverride,
}: {
  current: Prospect;
  other: Prospect;
  /** When provided, used instead of the global sticky format
   *  preference — lets a page with its own visible format toggle
   *  (e.g. /compare) control exactly what this shows, rather than
   *  silently following whatever the user last set somewhere else
   *  on the site. */
  format?: LeagueFormat;
}) {
  // Real, confirmed bug: this previously always read current.ddScore/
  // other.ddScore — the static base field, not any format-aware one —
  // meaning this comparison never actually respected the site's
  // 1QB/Superflex/TEP toggle at all, anywhere it was used (the
  // homepage widget, /compare, and the Similar Prospects modal). Now
  // reads the same sticky global format preference the rest of the
  // site uses (via the existing getDDScore utility, rather than
  // duplicating that field-mapping logic here) — unless a caller
  // passes its own format explicitly (see formatOverride above).
  const [syncedFormat, setSyncedFormat] = useState<LeagueFormat>("SUPERFLEX");
  useEffect(() => {
    if (formatOverride === undefined) setSyncedFormat(getGlobalFormat());
  }, [formatOverride]);
  const format = formatOverride ?? syncedFormat;

  const currentResolved = isResolved(current);
  const crossRegime = currentResolved !== isResolved(other);
  const REGIME_SPECIFIC_LABELS = new Set(["Draft Capital", "Opportunity", "Mock"]);

  const overallLabel = currentResolved ? "DD Score" : "Pre-Draft Score";
  // Drafted players compare on DD Score for the active format. If
  // the current player is undrafted, both sides use Pre-Draft Score
  // instead — a real, confirmed bug this fixes: this used to call
  // getDisplayedPreDraftScore(other, format), but that function has
  // ranking-table-specific branching that switches away from Pre-Draft
  // Score once a prospect has been drafted. For a comparison target in a
  // different regime, that could silently produce a different score.
  // applyFormatAdjustment operates
  // directly on the raw preDraftScore field, with no class-year
  // gating, so both sides of a devy comparison actually move with
  // the format toggle and actually represent the same thing.
  const overallA = currentResolved ? getDDScore(current, format) : applyFormatAdjustment(current.preDraftScore, current.position, format);
  const overallB = currentResolved ? getDDScore(other, format) : applyFormatAdjustment(other.preDraftScore, other.position, format);

  const rows = [
    {
      label: overallLabel,
      a: overallA,
      b: overallB,
      aText: undefined as string | undefined,
      bText: undefined as string | undefined,
    },
    ...(current.subScores ?? [])
      .filter((s) => !crossRegime || !REGIME_SPECIFIC_LABELS.has(s.label))
      .map((s) => {
        const match = other.subScores?.find((o) => o.label === s.label);
        return {
          label: s.label,
          a: s.value,
          b: match?.value,
          aText: s.text,
          bText: match?.text,
        };
      }),
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Link
            href={playerHref(current.id, format)}
            prefetch={false}
            className="block truncate font-headline text-xl uppercase leading-tight text-ink hover:text-accent"
          >
            {current.name}
          </Link>
          <p className="flex items-center gap-1 truncate text-xs text-ink-tertiary">
            <SchoolLogo url={current.schoolLogoUrl} size={12} /> {current.school ?? "—"}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <Link
            href={playerHref(other.id, format)}
            prefetch={false}
            className="block truncate font-headline text-xl uppercase leading-tight text-ink hover:text-accent"
          >
            {other.name}
          </Link>
          <p className="flex items-center justify-end gap-1 truncate text-xs text-ink-tertiary">
            {other.school ?? "—"} <SchoolLogo url={other.schoolLogoUrl} size={12} />
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col divide-y divide-border border-y border-border">
        {rows.map((r) => {
          const hasBoth = r.a !== undefined && r.b !== undefined;
          const aWins = hasBoth && r.a! > r.b!;
          const bWins = hasBoth && r.b! > r.a!;
          return (
            <div key={r.label} className="grid grid-cols-3 items-center gap-2 py-3">
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  aWins ? "text-riser" : bWins ? "text-faller" : "text-ink"
                )}
              >
                {r.aText ?? r.a?.toFixed(1) ?? "—"}
              </span>
              <span className="text-center font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                {r.label}
              </span>
              <span
                className={cn(
                  "text-right font-mono text-sm font-semibold",
                  bWins ? "text-riser" : aWins ? "text-faller" : "text-ink"
                )}
              >
                {r.bText ?? r.b?.toFixed(1) ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
