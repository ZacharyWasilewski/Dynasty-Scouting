import type { LeagueFormat } from "@/lib/ddScore";

const VALID: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];
export const GLOBAL_FORMAT_EVENT = "dd:format-change";

export const DEFAULT_FORMAT: LeagueFormat = "SUPERFLEX";

/**
 * League format is page-local. Every page starts on Superflex with TEP off,
 * unless the URL carries an explicit, valid ?format= (an in-page link or a
 * shared link). The only memory is Back/Forward restoration of the exact page
 * you left (lib/formatPersistence). Nothing is carried from one page to the
 * next, so this always returns the default; it stays as the single place
 * callers ask "what format do I start in?".
 */
export function getGlobalFormat(): LeagueFormat {
  return DEFAULT_FORMAT;
}

/** URL value when valid, otherwise the default. */
export function resolveFormat(urlValue: string | null | undefined): LeagueFormat {
  return parseFormatParam(urlValue) ?? DEFAULT_FORMAT;
}

const PARAM_TO_FORMAT: Record<string, LeagueFormat> = {
  "1qb": "1QB",
  sf: "SUPERFLEX",
  "1qb-tep": "1QB_TEP",
  "sf-tep": "SUPERFLEX_TEP",
};

/** Strict parse of a ?format= value; null when absent or unrecognized. */
export function parseFormatParam(value: string | null | undefined): LeagueFormat | null {
  if (!value) return null;
  if (isValidFormat(value)) return value;
  return PARAM_TO_FORMAT[value.toLowerCase()] ?? null;
}

/**
 * Call whenever a page's own format changes. Only notifies listeners on the
 * current page (e.g. the homepage sections); nothing is saved for other pages
 * or later visits.
 */
export function reportFormatUsed(format: LeagueFormat) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<LeagueFormat>(GLOBAL_FORMAT_EVENT, { detail: format }));
  } catch {
    // Never let a listener failure block the visible page.
  }
}

export function isValidFormat(value: string | null): value is LeagueFormat {
  return !!value && (VALID as string[]).includes(value);
}
