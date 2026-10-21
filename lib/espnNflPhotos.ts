import { matchKey } from "@/lib/collegePhotos";

/**
 * Last-resort headshots for drafted players Sleeper no longer lists
 * (older / retired players). Looks the player up by exact name in ESPN's
 * public player search and builds the standard NFL headshot URL from the
 * athlete id. ESPN's API is undocumented, so everything here is
 * best-effort and non-blocking:
 *  - results are cached in memory (misses too, so we don't re-search every
 *    request),
 *  - lookups run in the background with low concurrency and short timeouts,
 *  - a page render only ever reads whatever is already cached.
 * Ambiguous names (several different NFL players with the same name) are
 * skipped rather than guessed, so nobody gets someone else's face.
 */

const SEARCH_URL = (name: string) =>
  `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&limit=10&type=player&sport=football&league=nfl`;
const headshotUrl = (id: string) => `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;

const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const CONCURRENCY = 4;
const TIMEOUT_MS = 6000;

type CacheEntry = { url: string | null; expires: number };
const cache = new Map<string, CacheEntry>();
let inFlight: Promise<void> | null = null;

interface SearchItem {
  id?: string | number;
  displayName?: string;
  name?: string;
  league?: string;
  sport?: string;
  position?: string;
  subtitle?: string;
  description?: string;
  fullName?: string;
  uid?: string;
}

function collectItems(json: unknown): SearchItem[] {
  const out: SearchItem[] = [];
  const root = json as { items?: unknown; results?: unknown } | null;
  if (Array.isArray(root?.items)) out.push(...(root.items as SearchItem[]));
  if (Array.isArray(root?.results)) {
    for (const r of root.results as { contents?: unknown }[]) {
      if (Array.isArray(r?.contents)) out.push(...(r.contents as SearchItem[]));
    }
  }
  return out;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Outcome = "hit" | "search-failed" | "no-match" | "ambiguous" | "image-missing";
const outcomeCounts: Record<Outcome, number> = { hit: 0, "search-failed": 0, "no-match": 0, ambiguous: 0, "image-missing": 0 };
let sampleLogged = 0;

async function resolveOne(name: string, position: string): Promise<{ url: string | null; outcome: Outcome }> {
  const res = await fetchWithTimeout(SEARCH_URL(name));
  if (!res || !res.ok) return { url: null, outcome: "search-failed" };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { url: null, outcome: "search-failed" };
  }
  const items = collectItems(json);
  if (sampleLogged < 2) {
    sampleLogged++;
    console.error(`[espn-nfl-photos] sample search for "${name}": ${items.length} items, first: ${JSON.stringify(items[0] ?? null).slice(0, 400)}`);
  }
  const key = matchKey(name);
  const matches = items.filter((item) => {
    const display = item.displayName ?? item.name ?? item.fullName;
    if (!display || item.id === undefined) return false;
    if (item.sport && item.sport !== "football") return false;
    return matchKey(display) === key;
  });
  const ids = [...new Set(matches.map((m) => String(m.id)))];
  let id: string | undefined;
  if (ids.length === 1) id = ids[0];
  else if (ids.length > 1) {
    // Same-name players: prefer NFL entries, then one that lists our position.
    const nfl = matches.filter((m) => m.league === "nfl" || String(m.uid ?? "").includes("l:28"));
    const nflIds = [...new Set(nfl.map((m) => String(m.id)))];
    if (nflIds.length === 1) id = nflIds[0];
    else {
      const pool = nfl.length > 0 ? nfl : matches;
      const byPos = pool.filter((m) => `${m.position ?? ""} ${m.subtitle ?? ""} ${m.description ?? ""}`.toUpperCase().includes(position.toUpperCase()));
      const posIds = [...new Set(byPos.map((m) => String(m.id)))];
      if (posIds.length === 1) id = posIds[0];
    }
    if (!id) return { url: null, outcome: "ambiguous" };
  }
  if (!id) return { url: null, outcome: "no-match" };
  // Confirm the image really exists (GET, body discarded).
  const url = headshotUrl(id);
  const img = await fetchWithTimeout(url);
  if (img) void img.body?.cancel();
  return img && img.ok ? { url, outcome: "hit" } : { url: null, outcome: "image-missing" };
}

async function fillCache(targets: { name: string; position: string }[]): Promise<void> {
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ name, position }) => {
        let url: string | null = null;
        try {
          const result = await resolveOne(name, position);
          url = result.url;
          outcomeCounts[result.outcome]++;
        } catch {
          outcomeCounts["search-failed"]++;
        }
        cache.set(matchKey(name), { url, expires: Date.now() + (url ? HIT_TTL_MS : MISS_TTL_MS) });
      })
    );
  }
  console.error(`[espn-nfl-photos] lookup pass done (${targets.length} players): ${JSON.stringify(outcomeCounts)}`);
}

/**
 * Returns the fallback headshots resolved so far (normalized name -> URL)
 * and starts a background lookup for any of `players` not cached yet.
 * Never waits on ESPN.
 */
export function getEspnNflPhotosIfReady(players: { name: string; position: string }[]): Map<string, string> {
  const now = Date.now();
  const result = new Map<string, string>();
  const todo: { name: string; position: string }[] = [];
  const seen = new Set<string>();
  for (const p of players) {
    const key = matchKey(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = cache.get(key);
    if (entry && entry.expires > now) {
      if (entry.url) result.set(key, entry.url);
    } else {
      todo.push(p);
    }
  }
  if (todo.length > 0 && !inFlight) {
    inFlight = fillCache(todo).finally(() => {
      inFlight = null;
    });
  }
  return result;
}
