import type { Prospect } from "@/types/prospect";

/** Every percentile subscore must reach this value. */
export const GENERATIONAL_SUBSCORE_MIN = 95;
/** Fewer percentile subscores than this is too thin a profile to judge. */
const MIN_PERCENTILE_SUBSCORES = 3;

/**
 * A "Generational" player has a 95th percentile or better on every percentile
 * subscore in their profile. It is a badge only; it never changes the tier.
 * Text-only subscores (Opportunity labels such as "QB1") and pending ones are
 * not percentiles and are ignored.
 */
export function isGenerationalProfile(prospect: Pick<Prospect, "subScores">): boolean {
  const percentiles = (prospect.subScores ?? []).filter(
    (s) => s.value !== undefined && !s.isPending
  );
  if (percentiles.length < MIN_PERCENTILE_SUBSCORES) return false;
  return percentiles.every((s) => (s.value as number) >= GENERATIONAL_SUBSCORE_MIN);
}
