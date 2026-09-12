import type { LeagueFormat } from "@/lib/ddScore";

const KEY = "dd_global_format";
const VALID: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];
export const GLOBAL_FORMAT_EVENT = "dd:format-change";

/**
 * The user's sticky format preference, read synchronously so a page's
 * format `useState` initializer can use it directly (no flash of the
 * wrong format on first paint). Falls back to "SUPERFLEX" for a genuinely
 * new visitor, same as before — the difference is this now persists
 * (localStorage, not sessionStorage) instead of resetting on every
 * fresh visit.
 */
export function getGlobalFormat(): LeagueFormat {
  // Site-wide default is always Superflex + Standard. Individual pages
  // persist their own active selection separately so browser Back/Forward
  // can restore the state that was actually active on that page without
  // making a previous format choice silently become the default everywhere.
  return "SUPERFLEX";
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
