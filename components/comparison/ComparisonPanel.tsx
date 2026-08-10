"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getOverallScore, isResolved } from "@/lib/similarProspects";
import type { Prospect } from "@/types/prospect";

export function ComparisonPanel({ current, other }: { current: Prospect; other: Prospect }) {
  const currentResolved = isResolved(current);
  const crossRegime = currentResolved !== isResolved(other);
  const REGIME_SPECIFIC_LABELS = new Set(["Draft Capital", "Opportunity", "Mock"]);

  const overallLabel = currentResolved ? "Prospect Score" : "Pre-Draft Score";
  // A pre-draft prospect always compares on Pre-Draft Score — using
  // the other player's Pre-Draft Score too, even if they're resolved
  // now, so the two sides stay apples-to-apples.
  const overallA = currentResolved ? getOverallScore(current) : current.preDraftScore;
  const overallB = currentResolved ? getOverallScore(other) : other.preDraftScore;

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
            href={`/players/${current.id}`}
            className="block truncate font-display text-lg font-semibold text-ink hover:text-accent"
          >
            {current.name}
          </Link>
          <p className="truncate text-xs text-ink-tertiary">{current.school ?? "—"}</p>
        </div>
        <div className="min-w-0 text-right">
          <Link
            href={`/players/${other.id}`}
            className="block truncate font-display text-lg font-semibold text-ink hover:text-accent"
          >
            {other.name}
          </Link>
          <p className="truncate text-xs text-ink-tertiary">{other.school ?? "—"}</p>
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
