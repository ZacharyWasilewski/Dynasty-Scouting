/**
 * Descriptions are copied verbatim from stageInfo in
 * ModelScoresSection.tsx (the same progression already shown on every
 * player profile) — not reworded or reinterpreted, so this can never
 * drift out of sync with what the site actually tells someone on an
 * individual player page. This component only adds the conceptual
 * framing (why the stages exist, in what order) around text that
 * already exists.
 */
const STAGES = [
  {
    label: "Raw Score",
    plain: "What the prospect's underlying college profile says",
    detail: "Judged on raw college production alone — ignores mock draft data, opportunity, and real draft position entirely.",
  },
  {
    label: "Pre-Draft Score",
    plain: "The same profile, read through the historical model",
    detail: "Calculated before the NFL Draft using the same metrics, standing in mock-draft data for a real draft position, still without opportunity.",
  },
  {
    label: "Positional Score",
    plain: "The core grade the model actually optimizes",
    detail: "The player's weighted profile metrics plus smaller backend adjustments — the primary input to the final score.",
  },
  {
    label: "DD Score",
    plain: "The final evaluation",
    detail: "Adds the complete evaluation context and real opportunity to the core positional grade.",
  },
];

export function CalibrationExplainer() {
  return (
    <div className="border border-border bg-surface p-6 sm:p-8">
      <span className="font-mono text-xs uppercase tracking-widest2 text-accent">How A Score Is Built</span>
      <h3 className="mt-2 font-display text-xl font-semibold tracking-tightest text-ink sm:text-2xl">
        From raw profile to final grade
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">
        Every player moves through the same four stages — each one adds real context the last stage did not have yet,
        rather than replacing it. This does not change what a score means; it is the same progression shown on every
        player&apos;s own profile, laid out end to end.
      </p>

      <div className="mt-6 flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className="flex flex-1 items-stretch">
            <div className="flex-1 border border-border bg-surface-raised p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">{stage.label}</p>
              <p className="mt-1.5 text-sm font-medium text-ink">{stage.plain}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-tertiary">{stage.detail}</p>
            </div>
            {i < STAGES.length - 1 && (
              <div className="hidden w-8 shrink-0 items-center justify-center text-ink-tertiary sm:flex" aria-hidden="true">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
