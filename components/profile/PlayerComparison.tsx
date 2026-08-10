"use client";

import { useState } from "react";
import { X, Users } from "lucide-react";
import { isResolved, getOverallScore } from "@/lib/similarProspects";
import { ComparisonPanel } from "@/components/comparison/ComparisonPanel";
import type { Prospect } from "@/types/prospect";

export function PlayerComparison({
  current,
  similar,
}: {
  current: Prospect;
  similar: Prospect[];
}) {
  const [comparing, setComparing] = useState<Prospect | null>(null);
  const currentResolved = isResolved(current);

  if (similar.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {similar.map((p) => {
          // Score shown here matches whatever basis the modal will
          // actually compare on — Pre-Draft Score for both sides
          // when the current player is still projecting, even if
          // this candidate happens to be resolved now.
          const score = currentResolved ? getOverallScore(p) : p.preDraftScore;
          return (
            <button
              key={p.id}
              onClick={() => setComparing(p)}
              className="group flex items-center justify-between gap-3 border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink group-hover:text-accent">{p.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                  {p.school ?? "—"} · {p.draftClass ?? "—"}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold text-ink-secondary">
                {score?.toFixed(1) ?? "—"}
              </span>
            </button>
          );
        })}
      </div>

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
