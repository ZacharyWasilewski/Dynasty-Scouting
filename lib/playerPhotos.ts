import { normalizeNameLoose } from "@/lib/schoolLookup";
import { reportStatus } from "@/lib/systemStatus";

// Sleeper's own docs say this ~5MB endpoint shouldn't be called more
// than once a day — headshots and roster info don't change that fast.
// Matches the same single-flight + long-TTL pattern used for the
// sheet data cache, so a burst of concurrent requests during a cold
// cache never triggers more than one fetch.
const REVALIDATE_SECONDS = 24 * 60 * 60;
// If the fetch fails or comes back empty, don't wait the full 24h to
// try again — retry sooner, while still serving the last known-good
// index in the meantime rather than wiping it out.
const RETRY_ON_FAILURE_SECONDS = 5 * 60;
// How long a genuinely cold process (right after a deploy) is worth
// waiting on the real fetch before giving up and proceeding without
// photos this cycle. Bounded on purpose — this is the one case where
// waiting at all is worth it, since without it photos wouldn't show
// up until a second sheet-data cycle happened to land after this
// fetch resolved in the background, which could be a couple of
// minutes of real traffic after every deploy.
const COLD_START_TIMEOUT_MS = 3000;

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string;
}

/** Minimal per-player info needed to resolve a Sleeper roster (a list
 *  of player_ids) into names/positions for the team-needs feature. */
export interface RosterPlayerInfo {
  name: string;
  position: string;
  team?: string;
}

let photoIndex: Map<string, string> | null = null;
let byIdIndex: Map<string, RosterPlayerInfo> | null = null;
let photoIndexExpires = 0;
let inFlight: Promise<{ photoIndex: Map<string, string>; byIdIndex: Map<string, RosterPlayerInfo> }> | null = null;

// Known nickname/preferred-name mismatches between how this site's
// sheet spells a player's name and how Sleeper's own database spells
// it — confirmed directly against Sleeper's own app (Will Fuller is
// stored as "William Fuller" there), not guessed. Applied before
// building any index key, so it's safe regardless of which side a
// given call is on: a name already in Sleeper's own canonical form
// (e.g. when indexing Sleeper's own data) just won't match any entry
// here and passes through unchanged.
const NICKNAME_ALIASES: Record<string, string> = {
  "will fuller": "william fuller",
};

function indexKey(name: string, position: string): string {
  // Same suffix-stripping as lib/collegePhotos.ts, for the same
  // reason — a prospect stored as "Marvin Harrison Jr." here and
  // Sleeper's own "full_name" field dropping the "Jr." (or vice
  // versa) otherwise never match on an exact string comparison.
  const withoutSuffix = normalizeNameLoose(name).replace(/\s+(jr|sr|ii|iii|iv|v)$/, "");
  const canonical = NICKNAME_ALIASES[withoutSuffix] ?? withoutSuffix;
  return `${canonical}|${position}`;
}

// Distinct prefix (colon never appears in a position code) so this
// can share the same Map as indexKey()'s position-specific entries
// without any collision risk — see lookupPlayerPhoto below for why
// this fallback exists: this site's sheet and Sleeper's own database
// don't always agree on a player's listed position (confirmed in
// production — N'Keal Harry is stored as TE in Sleeper despite
// having played WR), which silently broke the exact-match lookup for
// anyone caught in that disagreement.
function nameOnlyKey(name: string): string {
  const withoutSuffix = normalizeNameLoose(name).replace(/\s+(jr|sr|ii|iii|iv|v)$/, "");
  const canonical = NICKNAME_ALIASES[withoutSuffix] ?? withoutSuffix;
  return `name-only:${canonical}`;
}

async function fetchPhotoIndex(): Promise<{ photoIndex: Map<string, string>; byIdIndex: Map<string, RosterPlayerInfo> }> {
  const index = new Map<string, string>();
  // Built from the exact same fetch/loop as the photo index below,
  // rather than a second independent fetch of this same ~5MB
  // endpoint — this app already had real memory pressure from
  // oversized fetches during build, so a feature that needs
  // Sleeper's player directory for a different purpose (resolving a
  // fantasy roster's player_ids to names) reuses this one instead of
  // doubling that cost.
  const byId = new Map<string, RosterPlayerInfo>();
  try {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl", {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[player-photos] Sleeper fetch returned ${res.status}`);
      return { photoIndex: index, byIdIndex: byId };
    }

    // Only the small bits actually needed (a name+position -> URL
    // index) are retained — the ~5MB raw response is free to be
    // garbage-collected right after this loop runs.
    const data = (await res.json()) as Record<string, SleeperPlayer>;
    for (const player of Object.values(data)) {
      if (!player.player_id || !player.position) continue;
      const name = player.full_name ?? `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
      if (!name) continue;
      const url = `https://sleepercdn.com/content/nfl/players/${player.player_id}.jpg`;
      index.set(indexKey(name, player.position), url);
      // First-write-wins fallback keyed on name alone — see
      // nameOnlyKey's comment for why this needs to exist at all.
      const nk = nameOnlyKey(name);
      if (!index.has(nk)) index.set(nk, url);
      byId.set(player.player_id, { name, position: player.position, team: player.team });
    }
  } catch (err) {
    // Never worth breaking a page load over — but log it, since a
    // silently-swallowed failure here previously looked identical to
    // "hasn't finished loading yet," which made a real outage
    // indistinguishable from expected first-load latency.
    console.error("[player-photos] Sleeper fetch failed:", err);
  }
  return { photoIndex: index, byIdIndex: byId };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    );
  });
}

/**
 * Player headshots only exist for prospects who've actually reached
 * an NFL roster — Sleeper's dataset doesn't cover pre-draft/devy
 * prospects at all, which lines up with how DD Score already treats
 * drafted vs. undrafted players differently. A missing match just
 * means no photo for that player; never an error.
 *
 * Non-blocking after the first call: once there's any cached data
 * (even stale), this returns instantly and refreshes in the
 * background — a slow or failing Sleeper response can never add
 * latency to a page load once the site has been running a while. The
 * one exception is a genuinely cold process (the first call ever,
 * right after a deploy), where it's worth a short, bounded wait — see
 * COLD_START_TIMEOUT_MS — so photos show up on the very first real
 * page load instead of only after a couple of 60s sheet-data cycles.
 */
export async function getPlayerPhotoIndexIfReady(): Promise<Map<string, string>> {
  const result = await ensureFetched();
  return result.photoIndex;
}

/**
 * Sleeper player_id -> name/position/team, for resolving a fantasy
 * roster's list of IDs into something displayable. Shares the same
 * underlying fetch and cache as the photo index above rather than
 * triggering its own — see fetchPhotoIndex for why.
 */
export async function getSleeperPlayerIndexIfReady(): Promise<Map<string, RosterPlayerInfo>> {
  const result = await ensureFetched();
  return result.byIdIndex;
}

/**
 * Single-flight fetch + cache for both indexes above. The key
 * behavior: a failed or empty fetch NEVER overwrites a previously
 * good cache — it keeps serving the last real index and just retries
 * sooner (RETRY_ON_FAILURE_SECONDS instead of the full 24h). Without
 * this, one transient Sleeper hiccup at exactly the wrong moment
 * would zero out every headshot on the site for up to a day.
 */
async function ensureFetched(): Promise<{ photoIndex: Map<string, string>; byIdIndex: Map<string, RosterPlayerInfo> }> {
  if (photoIndex && byIdIndex && photoIndexExpires > Date.now()) {
    return { photoIndex, byIdIndex };
  }

  const wasNeverFetched = photoIndex === null;

  if (!inFlight) {
    inFlight = fetchPhotoIndex()
      .then((result) => {
        const hasData = result.photoIndex.size > 0 || result.byIdIndex.size > 0;
        if (hasData || photoIndex === null) {
          photoIndex = result.photoIndex;
          byIdIndex = result.byIdIndex;
          photoIndexExpires = Date.now() + REVALIDATE_SECONDS * 1000;
          reportStatus("sleeper-players", "ok", `${result.photoIndex.size} player headshots indexed`);
        } else {
          // Empty/failed fetch, but a good cache already exists —
          // keep serving it, just come back sooner.
          photoIndexExpires = Date.now() + RETRY_ON_FAILURE_SECONDS * 1000;
          reportStatus("sleeper-players", "stale", `Fetch came back empty — still serving ${photoIndex?.size ?? 0} cached headshots`);
        }
        return { photoIndex: photoIndex ?? new Map(), byIdIndex: byIdIndex ?? new Map() };
      })
      .finally(() => {
        inFlight = null;
      });
  }

  if (wasNeverFetched) {
    return withTimeout(inFlight, COLD_START_TIMEOUT_MS, { photoIndex: new Map(), byIdIndex: new Map() });
  }
  // Stale-while-revalidate: serve the current (possibly stale) cache
  // immediately, let the refresh finish in the background.
  return { photoIndex: photoIndex ?? new Map(), byIdIndex: byIdIndex ?? new Map() };
}

export function lookupPlayerPhoto(
  index: Map<string, string>,
  name: string,
  position: string
): string | undefined {
  // Exact name+position match first (most precise), falling back to
  // name-only if this site's sheet and Sleeper's own database
  // disagree on the player's position — see nameOnlyKey's comment.
  return index.get(indexKey(name, position)) ?? index.get(nameOnlyKey(name));
}
