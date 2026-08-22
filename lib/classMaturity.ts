/**
 * A draft class needs real NFL career history before hit rate or
 * Approximate Value numbers mean anything. A class becomes "mature"
 * once more than this many years have passed since it was drafted.
 * Based on the real current year, not the platform's forward-looking
 * draft cycle badge.
 */
export const TREND_MATURITY_YEARS = 2;

export function isClassMature(classYear: string): boolean {
  const currentYear = new Date().getFullYear();
  return currentYear - Number(classYear) > TREND_MATURITY_YEARS;
}
