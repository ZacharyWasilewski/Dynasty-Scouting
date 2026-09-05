import type { SubScore } from "@/types/prospect";
import { qualitativeLabelForPercentile } from "@/lib/tiers";

/**
 * Confirmed missing before this was built: nowhere on the profile
 * converts the subscore percentiles into a plain sentence about what
 * they actually mean for a decision. The data already exists (every
 * number here is a real subscore value already computed and shown
 * elsewhere on the page as a ring/bar) — this only picks out the
 * highest and lowest and states them in a sentence, nothing invented.
 *
 * "Draft Capital" and "Opportunity" subscores can be flagged
 * isPending for a player who hasn't been drafted yet — those aren't
 * a real weakness, just not-yet-determined, so they're excluded here
 * the same way the existing subscore list itself already treats them
 * (rendering "TBD" instead of a percentile). Including a pending
 * score as someone's "weakest signal" would misrepresent something
 * that simply doesn't exist yet as an actual deficiency.
 */
export function DecisionSignals({ subScores }: { subScores: SubScore[] | undefined }) {
  const real = (subScores ?? []).filter(
    (s): s is SubScore & { value: number } => s.value !== undefined && !s.isPending
  );

  // Two is the minimum for "strongest vs weakest" to mean anything —
  // below that there's nothing to contrast, so the component simply
  // doesn't render rather than force a comparison out of one number.
  if (real.length < 2) return null;

  const sorted = [...real].sort((a, b) => b.value - a.value);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  // TypeScript types array indexing as possibly-undefined regardless
  // of the length check above (it doesn't connect the two facts) —
  // this guard is what the build actually needs to narrow both to
  // real values, not just a defensive-looking no-op.
  if (!strongest || !weakest) return null;

  // A genuine tie band, not float-equality — if the gap between the
  // best and worst signal is small, calling one out as meaningfully
  // "weak" relative to the other would overstate a difference that
  // isn't really there.
  const hasRealSpread = strongest.value - weakest.value >= 10;

  return (
    <div className="border-t border-border bg-void/15 px-4 py-3 sm:px-5 lg:px-6">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-widest2 text-ink-secondary">
        Strongest &amp; Weakest Signals
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary sm:text-sm">
        Strongest: <span className="font-semibold text-ink">{strongest.label}</span> (
        {qualitativeLabelForPercentile(strongest.value)}, {strongest.value}th percentile).
        {hasRealSpread ? (
          <>
            {" "}Weakest: <span className="font-semibold text-ink">{weakest.label}</span> (
            {qualitativeLabelForPercentile(weakest.value)}, {weakest.value}th percentile).
          </>
        ) : (
          " No real weak point — every measured signal sits close together."
        )}
      </p>
    </div>
  );
}
