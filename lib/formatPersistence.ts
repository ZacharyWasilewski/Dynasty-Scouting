import type { LeagueFormat } from "@/lib/ddScore";

const LAST_POPSTATE_KEY = "__ddLastPopStateAt";
const FORMAT_KEY_PREFIX = "__ddFormat:";

// A back/forward mount has to happen essentially immediately after the
// popstate event that caused it (same event loop / next paint). A wide
// window still safely excludes an unrelated later visit.
const BACK_NAV_WINDOW_MS = 1500;

export const VALID_FORMATS: LeagueFormat[] = ["1QB", "1QB_TEP", "SUPERFLEX", "SUPERFLEX_TEP"];

/** Call once, from a component that stays mounted across every route
 *  change (e.g. the root layout), so this is never subject to a race
 *  against any individual page's own mount/unmount timing. */
export function markPopState() {
  try {
    sessionStorage.setItem(LAST_POPSTATE_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — back-restore
    // just won't work; fresh/reload default behavior is unaffected.
  }
}

/** True only when this exact mount is happening as the direct result of
 *  a real browser Back/Forward. A reload never fires popstate, so it
 *  never sets this. A normal Link click never fires popstate either. */
export function wasRecentBackNavigation(): boolean {
  try {
    const raw = sessionStorage.getItem(LAST_POPSTATE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < BACK_NAV_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Persist the current format for one specific listing page (keyed by
 *  its pathname, so /players, each /positions/[position], and each
 *  /classes/[year] all remember their own format independently). */
export function saveFormatForPath(pathname: string, format: LeagueFormat) {
  try {
    sessionStorage.setItem(FORMAT_KEY_PREFIX + pathname, format);
  } catch {
    // ignore
  }
}

/** Read back a previously saved format for a path, if any. */
export function getSavedFormatForPath(pathname: string): LeagueFormat | null {
  try {
    const raw = sessionStorage.getItem(FORMAT_KEY_PREFIX + pathname);
    return raw && (VALID_FORMATS as string[]).includes(raw) ? (raw as LeagueFormat) : null;
  } catch {
    return null;
  }
}

/** The single call a listing page's format `useState` initializer needs:
 *  restores the saved format only on a genuine Back/Forward into this
 *  exact path, and defaults every other time (fresh visit, reload,
 *  normal link navigation). */
export function initialFormatForPath(pathname: string): LeagueFormat {
  if (typeof window === "undefined") return "1QB";
  if (!wasRecentBackNavigation()) return "1QB";
  return getSavedFormatForPath(pathname) ?? "1QB";
}

const GENERIC_STATE_PREFIX = "__ddState:";

/** Persist an arbitrary bit of page toggle state (not tied to a path). */
export function saveState(key: string, value: string) {
  try {
    sessionStorage.setItem(GENERIC_STATE_PREFIX + key, value);
  } catch {
    // ignore
  }
}

function getSavedState(key: string): string | null {
  try {
    return sessionStorage.getItem(GENERIC_STATE_PREFIX + key);
  } catch {
    return null;
  }
}

/** Same restore-only-on-genuine-Back/Forward rule as initialFormatForPath,
 *  generalized to any string-enum toggle (e.g. the Analytics page's
 *  Standard/Weighted and league-format switches) so leaving the page and
 *  hitting Back lands you back where you were, without a fresh visit or
 *  a normal link click ever silently inheriting old state. */
export function initialStateFor<T extends string>(
  key: string,
  defaultValue: T,
  validValues: readonly T[]
): T {
  if (typeof window === "undefined") return defaultValue;
  if (!wasRecentBackNavigation()) return defaultValue;
  const raw = getSavedState(key);
  return raw && (validValues as readonly string[]).includes(raw) ? (raw as T) : defaultValue;
}
