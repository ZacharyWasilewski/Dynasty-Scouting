import type { LeagueFormat } from "@/lib/ddScore";

const KEY = "dd_global_format";
const VALID: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];

/**
 * The user's sticky format preference, read synchronously so a page's
 * format `useState` initializer can use it directly (no flash of the
 * wrong format on first paint). Falls back to "1QB" for a genuinely
 * new visitor, same as before — the difference is this now persists
 * (localStorage, not sessionStorage) instead of resetting on every
 * fresh visit.
 */
export function getGlobalFormat(): LeagueFormat {
  if (typeof window === "undefined") return "1QB";
  try {
    const raw = localStorage.getItem(KEY);
    return raw && (VALID as string[]).includes(raw) ? (raw as LeagueFormat) : "1QB";
  } catch {
    return "1QB";
  }
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
  fetch("/api/preferences/format", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  }).catch(() => {});
}

export function isValidFormat(value: string | null): value is LeagueFormat {
  return !!value && (VALID as string[]).includes(value);
}
