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

const SEARCH_URLS = (name: string) => {
  const q = encodeURIComponent(name);
  return [
    // The endpoint espn.com's own site search uses — indexes retired players too.
    `https://site.web.api.espn.com/apis/search/v2?region=us&lang=en&query=${q}&limit=10&mode=prefix&page=1`,
    `https://site.web.api.espn.com/apis/common/v3/search?query=${q}&limit=10&type=player&sport=football`,
  ];
};
// ESPN league ids inside an athlete uid ("s:20~l:28~a:12345"): 28 = NFL, 23 = college football.
const headshotUrl = (id: string, leagueId: string) =>
  leagueId === "28"
    ? `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`
    : `https://a.espncdn.com/i/headshots/college-football/players/full/${id}.png`;

const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const CONCURRENCY = 4;
const TIMEOUT_MS = 6000;

type CacheEntry = { url: string | null; heightIn?: number; weightLbs?: number; expires: number };
const cache = new Map<string, CacheEntry>();
let inFlight: Promise<void> | null = null;
let missLogged = 0;

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
let diagLogged = 0;

interface Candidate {
  id: string;
  leagueId: string;
  text: string;
}

function toCandidates(items: SearchItem[], key: string): Candidate[] {
  const out: Candidate[] = [];
  for (const item of items) {
    const display = item.displayName ?? item.name ?? item.fullName;
    if (!display || matchKey(display) !== key) continue;
    if (item.sport && item.sport !== "football") continue;
    const uid = String(item.uid ?? "");
    // The numeric athlete id lives in the uid ("s:20~l:28~a:13208"); the
    // item's own `id` is a GUID in the v2 search response.
    const id = /~a:(\d+)/.exec(uid)?.[1] ?? (item.id !== undefined && /^\d+$/.test(String(item.id)) ? String(item.id) : undefined);
    if (!id) continue;
    // Skip anything that isn't an athlete (teams, articles, etc.).
    if (uid && !uid.includes("~a:")) continue;
    const leagueId = /~l:(\d+)/.exec(uid)?.[1] ?? (item.league === "nfl" ? "28" : "");
    if (leagueId !== "28" && leagueId !== "23") continue;
    out.push({ id, leagueId, text: `${item.position ?? ""} ${item.subtitle ?? ""} ${item.description ?? ""}`.toUpperCase() });
  }
  return out;
}

type Resolved = { url: string | null; outcome: Outcome; heightIn?: number; weightLbs?: number };

async function fetchBio(id: string, leagueId: string): Promise<{ heightIn?: number; weightLbs?: number }> {
  const sport = leagueId === "28" ? "nfl" : "college-football";
  const res = await fetchWithTimeout(`https://site.web.api.espn.com/apis/common/v3/sports/football/${sport}/athletes/${id}`);
  if (!res || !res.ok) return {};
  try {
    const json = (await res.json()) as { athlete?: { height?: number; weight?: number } };
    const h = Number(json.athlete?.height);
    const w = Number(json.athlete?.weight);
    return { heightIn: h >= 60 && h <= 90 ? Math.round(h) : undefined, weightLbs: w >= 140 && w <= 400 ? Math.round(w) : undefined };
  } catch {
    return {};
  }
}

async function resolveOne(name: string, position: string): Promise<Resolved> {
  const key = matchKey(name);
  let anySearchOk = false;
  let candidates: Candidate[] = [];
  for (const searchUrl of SEARCH_URLS(name)) {
    const res = await fetchWithTimeout(searchUrl);
    if (!res || !res.ok) continue;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      continue;
    }
    anySearchOk = true;
    const items = collectItems(json);
    candidates = toCandidates(items, key);
    if (candidates.length === 0 && diagLogged < 3) {
      diagLogged++;
      const root = json && typeof json === "object" ? Object.keys(json as object).join(",") : typeof json;
      console.error(`[espn-nfl-photos] no match for "${name}" via ${new URL(searchUrl).pathname}: ${items.length} items, root keys [${root}], first: ${JSON.stringify(items[0] ?? null).slice(0, 300)}`);
    }
    if (candidates.length > 0) break;
  }
  if (!anySearchOk) return { url: null, outcome: "search-failed" };
  if (candidates.length === 0) return { url: null, outcome: "no-match" };

  // Prefer NFL entries; fall back to college-football ones.
  const nfl = candidates.filter((c) => c.leagueId === "28");
  const pool = nfl.length > 0 ? nfl : candidates;
  let ids = [...new Set(pool.map((c) => c.id))];
  if (ids.length > 1) {
    const byPos = pool.filter((c) => c.text.includes(position.toUpperCase()));
    ids = [...new Set(byPos.map((c) => c.id))];
  }
  if (ids.length !== 1) return { url: null, outcome: "ambiguous" };
  const chosen = pool.find((c) => c.id === ids[0])!;

  // Confirm the image really exists (GET, body discarded).
  const url = headshotUrl(chosen.id, chosen.leagueId);
  const img = await fetchWithTimeout(url);
  if (img) void img.body?.cancel();
  const bio = await fetchBio(chosen.id, chosen.leagueId);
  if (img && img.ok) return { url, outcome: "hit", ...bio };
  // Some athletes only have a headshot through ESPN's image combiner.
  const folder = chosen.leagueId === "28" ? "nfl" : "college-football";
  const combiner = `https://a.espncdn.com/combiner/i?img=/i/headshots/${folder}/players/full/${chosen.id}.png&w=350&h=254`;
  const img2 = await fetchWithTimeout(combiner);
  if (img2) void img2.body?.cancel();
  return img2 && img2.ok ? { url: combiner, outcome: "hit", ...bio } : { url: null, outcome: "image-missing", ...bio };
}

async function fillCache(targets: { name: string; position: string }[]): Promise<void> {
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ name, position }) => {
        let url: string | null = null;
        let bio: { heightIn?: number; weightLbs?: number } = {};
        try {
          const result = await resolveOne(name, position);
          url = result.url;
          bio = { heightIn: result.heightIn, weightLbs: result.weightLbs };
          if (result.outcome !== "hit" && missLogged < 40) {
            missLogged++;
            console.error(`[espn-nfl-photos] ${result.outcome}: ${name} (${position})`);
          }
          outcomeCounts[result.outcome]++;
        } catch {
          outcomeCounts["search-failed"]++;
        }
        cache.set(matchKey(name), { url, ...bio, expires: Date.now() + (url ? HIT_TTL_MS : MISS_TTL_MS) });
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

/** Height/weight ESPN reported for players already resolved (normalized name -> bio). */
export function getEspnNflBios(): Map<string, { heightIn?: number; weightLbs?: number }> {
  const out = new Map<string, { heightIn?: number; weightLbs?: number }>();
  for (const [key, e] of cache) {
    if (e.heightIn !== undefined || e.weightLbs !== undefined) out.set(key, { heightIn: e.heightIn, weightLbs: e.weightLbs });
  }
  return out;
}
