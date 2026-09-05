"use client";

import type { Prospect } from "@/types/prospect";
import { ddScoreForFormat, tierForFormat } from "@/lib/analytics";
import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

function resolved(p: Prospect) { return p.hitMiss === "HIT" || p.hitMiss === "MISS"; }
function hitRate(rows: Prospect[]) {
  const r = rows.filter(resolved);
  return r.length ? (r.filter(p => p.hitMiss === "HIT").length / r.length) * 100 : null;
}

export function WhatDDAdds({ prospects }: { prospects: Prospect[] }) {
  const { selection } = useLeagueFormat();
  const historical = prospects.filter(p => p.hasDraftData === true && resolved(p) && ddScoreForFormat(p, selection) !== undefined && p.adp !== undefined);
  if (!historical.length) return null;

  const rounds = [1,2,3,4].map(round => historical.filter(p => Math.ceil((p.adp as number) / 12) === round));
  const roundRows = rounds.map((rows, i) => {
    const ranked = [...rows].sort((a,b) => (ddScoreForFormat(b, selection) ?? -Infinity) - (ddScoreForFormat(a, selection) ?? -Infinity));
    const half = Math.max(1, Math.floor(ranked.length / 2));
    const top = ranked.slice(0, half), bottom = ranked.slice(-half);
    return { round: i + 1, n: rows.length, top: hitRate(top), bottom: hitRate(bottom) };
  }).filter(r => r.n >= 4);

  const lateHits = historical.filter(p => (p.adp as number) > 48 && p.hitMiss === "HIT").sort((a,b) => (ddScoreForFormat(b, selection) ?? 0) - (ddScoreForFormat(a, selection) ?? 0)).slice(0,3);
  const earlyMisses = historical.filter(p => (p.adp as number) <= 12 && p.hitMiss === "MISS").sort((a,b) => (ddScoreForFormat(a, selection) ?? 0) - (ddScoreForFormat(b, selection) ?? 0)).slice(0,3);
  const agreement = historical.filter(p => {
    const score = ddScoreForFormat(p, selection); const tier = tierForFormat(p, selection);
    return score !== undefined && tier !== undefined;
  });
  const preDraftCount = prospects.filter(p => p.preDraftScore !== undefined && p.hasDraftData !== true).length;

  return (
    <section className="border border-border-strong bg-surface p-6 sm:p-8">
      <span className="font-mono text-xs uppercase tracking-widest2 text-accent">What DD Adds Beyond Draft Capital</span>
      <h3 className="mt-2 font-display text-xl font-semibold tracking-tightest text-ink sm:text-2xl">Separate the signal from the outcome</h3>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
        Draft capital is known only after the NFL Draft. DD&apos;s pre-draft evaluation is designed to use information available before that event; the final DD Score can then incorporate post-draft context such as draft capital and opportunity. These are different questions, so this page keeps them separate rather than pretending one number answers both.
      </p>

      <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pre-Draft Score", "Before the NFL Draft", "Prospect signals without actual NFL draft position."],
          ["O.I.S.", "Opportunity-independent", "Quantitative evaluation without qualitative opportunity."],
          ["DD Score", "Final evaluation", "Calibrated score using the complete available evaluation context."],
          ["Draft Capital", "Post-draft signal", "Where the NFL actually selected the player."],
        ].map(([title, stage, copy]) => (
          <div key={title} className="bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">{stage}</p>
            <p className="mt-2 font-display text-base font-semibold text-ink">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">{copy}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="border border-border bg-void/20 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Does DD separate players within a round?</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Within each NFL round, players are split into the higher and lower halves by DD Score. A gap here means the model is adding ordering information beyond simply knowing the round.</p>
          <div className="mt-4 space-y-2">
            {roundRows.map(r => (
              <div key={r.round} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-t border-border pt-2 text-xs">
                <span className="font-mono text-ink-tertiary">R{r.round}</span>
                <span className="text-ink-secondary">DD top half <strong className="text-ink">{r.top === null ? "—" : `${r.top.toFixed(0)}%`}</strong> · bottom <strong className="text-ink">{r.bottom === null ? "—" : `${r.bottom.toFixed(0)}%`}</strong></span>
                <span className="font-mono text-ink-tertiary">n={r.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-void/20 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Where the model can add context</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">These examples are selected mechanically from the current dataset, not hand-picked marketing stories.</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-riser">Late-draft hits</p>
              <p className="mt-1 text-xs text-ink-tertiary">{lateHits.length ? lateHits.map(p => `${p.name} (${ddScoreForFormat(p, selection)?.toFixed(0)})`).join(" · ") : "No resolved examples in rounds 5+ with a DD Score."}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-faller">Round-1 misses</p>
              <p className="mt-1 text-xs text-ink-tertiary">{earlyMisses.length ? earlyMisses.map(p => `${p.name} (${ddScoreForFormat(p, selection)?.toFixed(0)})`).join(" · ") : "No resolved round-1 misses in the current sample."}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Pre-draft sample</p>
              <p className="mt-1 text-xs text-ink-tertiary">{preDraftCount.toLocaleString()} prospects currently have a pre-draft score and have not yet reached the drafted stage. Those grades should be judged on information available at that stage, not hindsight.</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-ink-tertiary">This is descriptive evidence, not proof of causation or statistical significance. Small cohorts are shown only as context and should not be treated as definitive.</p>
    </section>
  );
}
