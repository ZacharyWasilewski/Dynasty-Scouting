import type { Prospect } from "@/types/prospect";

/** The average percentile subscore must be above this value. */
export const GENERATIONAL_AVERAGE_ABOVE = 90;
/** Fewer percentile subscores than this is too thin a profile to judge. */
const MIN_PERCENTILE_SUBSCORES = 3;

/**
 * A "Generational" player averages above the 90th percentile across the
 * percentile subscores in their profile. It is a badge only; it never changes the tier.
 * Text-only subscores (Opportunity labels such as "QB1") and pending ones are
 * not percentiles and are ignored.
 */
export function isGenerationalProfile(prospect: Pick<Prospect, "subScores">): boolean {
  const percentiles = (prospect.subScores ?? []).filter(
    (s) => s.value !== undefined && !s.isPending
  );
  if (percentiles.length < MIN_PERCENTILE_SUBSCORES) return false;
  const average = percentiles.reduce((sum, s) => sum + (s.value as number), 0) / percentiles.length;
  return average > GENERATIONAL_AVERAGE_ABOVE;
}
