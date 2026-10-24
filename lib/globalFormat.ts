import type { LeagueFormat } from "@/lib/ddScore";

const KEY = "dd_global_format";
const VALID: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];
export const GLOBAL_FORMAT_EVENT = "dd:format-change";

export const DEFAULT_FORMAT: LeagueFormat = "SUPERFLEX";

/**
 * Format precedence used everywhere on the site:
 *   1. an explicit, valid ?format= in the URL (shared links, in-page links),
 *   2. the user's saved preference (localStorage, written only when the user
 *      actually picks a format),
 *   3. Superflex with TEP off.
 * This returns layers 2 and 3. Call it from an effect (not a render-time
 * initializer) so the first client render matches the server render.
 */
export function getGlobalFormat(): LeagueFormat {
  if (typeof window === "undefined") return DEFAULT_FORMAT;
  try {
    const raw = localStorage.getItem(KEY);
    return isValidFormat(raw) ? raw : DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
}

/** Layers 1-3 together, for callers that have the raw URL value in hand. */
export function resolveFormat(urlValue: string | null | undefined): LeagueFormat {
  const fromUrl = parseFormatParam(urlValue);
  return fromUrl ?? getGlobalFormat();
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
 * Call whenever a page's own format changes. Writes localStorage
 * immediately (works instantly, every device, logged in or not), and
 * fire-and-forgets a save to the account too — the API route itself
 * is the auth gate, so this is safe to call unconditionally; a
 * logged-out request just no-ops server-side.
 */
export function reportFormatUsed(format: LeagueFormat) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, format);
  } catch {
    // Private browsing / storage disabled — the account save below
    // still gets attempted for a logged-in user; a guest just won't
    // have it stick locally, which was already the ceiling before.
  }
  try {
    window.dispatchEvent(new CustomEvent<LeagueFormat>(GLOBAL_FORMAT_EVENT, { detail: format }));
  } catch {
    // A storage/API failure should never prevent the visible page from using
    // the newly selected format.
  }
  fetch("/api/preferences/format", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  }).catch(() => {});
}

export function isValidFormat(value: string | null): value is LeagueFormat {
  return !!value && (VALID as string[]).includes(value);
}
