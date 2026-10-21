/**
 * Thin client for Sleeper's public, read-only API (no auth/API key —
 * see https://docs.sleeper.com). Used only for the "sync your league"
 * team-needs feature; nothing here touches the prospect data pipeline.
 *
 * Deliberately short-lived caching (a few minutes, not the 24h used
 * for the Sleeper player directory in lib/playerPhotos.ts) — league
 * rosters change via trades/waivers and a stale read here would give
 * someone a wrong "who's on my team" picture, unlike a headshot which
 * is fine to be a day stale.
 */
const REVALIDATE_SECONDS = 300;

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  roster_positions: string[];
  /** "pre_draft" | "drafting" | "in_season" | "complete" — critical
   *  for real pick order: a season's standings (and therefore its
   *  draft slot order for the FOLLOWING year's rookie class) aren't
   *  meaningfully final until this is "complete". Using in-progress
   *  or not-yet-started standings to compute a slot produces a
   *  fabricated result, not a real one — see computeRealDraftOrder's
   *  caller in app/api/sleeper/route.ts for where this gets checked. */
  status?: string;
  /** Loosely typed — Sleeper doesn't document every possible key,
   *  and this app only reads a couple of specific ones (see
   *  isTepLeague in lib/teamNeeds.ts). Untyped rather than guessing
   *  at a full schema for fields this app doesn't use. */
  scoring_settings?: Record<string, number>;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  /** Standings data — used to determine draft slot (worst record
   *  picks first, the standard dynasty rookie-draft convention),
   *  which in turn determines whether a team's picks land in the
   *  Early/Mid/Late third of each round for pick valuation. Always
   *  present on Sleeper's real API response; typed optional here
   *  only as a defensive fallback if a field is ever missing. */
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
  };
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

/**
 * One draft object from GET /league/{league_id}/drafts — a league
 * has one of these per season, including future/not-yet-run ones.
 * draft_order, when Sleeper or the commissioner has actually set it,
 * is the single most authoritative source of "who picks where" this
 * app can get — more trustworthy than any standings-based
 * computation, since it reflects Sleeper's own real, current
 * understanding rather than this app's own projection. Maps
 * user_id -> 1-indexed slot number; absent/null when nothing's been
 * set yet for that draft.
 */
export interface SleeperDraft {
  draft_id: string;
  season: string;
  status?: string;
  draft_order?: Record<string, number> | null;
}

/** One entry per traded pick, reflecting its CURRENT owner directly
 *  (Sleeper resolves multi-hop trade chains server-side — this
 *  endpoint never requires walking a chain of trades manually). */
export interface SleeperTradedPick {
  season: string;
  round: number;
  /** The roster this pick originally belonged to (whose regular-
   *  season finish determines its draft slot) — NOT necessarily who
   *  owns it now. */
  roster_id: number;
  /** Who owns it now. */
  owner_id: number;
}

async function sleeperGet<T>(path: string, opts?: { fresh?: boolean }): Promise<T | null> {
  try {
    const res = await fetch(`https://api.sleeper.app/v1${path}`, {
      // fresh: true bypasses the normal 5-minute cache entirely —
      // used specifically for real pick order, where stale data
      // (a trade that already happened, standings from a stale
      // snapshot) is actively misleading rather than just a minor
      // staleness tradeoff.
      next: opts?.fresh ? { revalidate: 0 } : { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[sleeper] GET ${path} returned ${res.status}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[sleeper] GET ${path} failed:`, err);
    return null;
  }
}

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  return sleeperGet<SleeperUser>(`/user/${encodeURIComponent(username.trim())}`);
}

// Sleeper leagues are labeled by the calendar year they start in. A
// league created for the season currently underway (as of this
// request) is the overwhelmingly common case; the fallback to the
// previous year covers the offseason window (Feb-Aug) before that
// year's leagues have been created yet.
function likelySeasons(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  return [String(year), String(year - 1)];
}

export async function getSleeperLeagues(userId: string): Promise<SleeperLeague[]> {
  for (const season of likelySeasons()) {
    const leagues = await sleeperGet<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
    if (leagues && leagues.length > 0) return leagues;
  }
  return [];
}

export async function getSleeperLeague(leagueId: string, opts?: { fresh?: boolean }): Promise<SleeperLeague | null> {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`, opts);
}

export async function getSleeperRosters(leagueId: string, opts?: { fresh?: boolean }): Promise<SleeperRoster[]> {
  return (await sleeperGet<SleeperRoster[]>(`/league/${leagueId}/rosters`, opts)) ?? [];
}

export async function getSleeperLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return (await sleeperGet<SleeperLeagueUser[]>(`/league/${leagueId}/users`)) ?? [];
}

/** Only picks that have actually been traded away from their default
 *  (own-team) owner show up here — a team that hasn't made any pick
 *  trades returns an empty array, which correctly means "everyone
 *  just owns their own picks," not an error. */
export async function getSleeperTradedPicks(leagueId: string, opts?: { fresh?: boolean }): Promise<SleeperTradedPick[]> {
  return (await sleeperGet<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`, opts)) ?? [];
}

/** Every draft object tied to this league, past and future — see
 *  SleeperDraft's own comment for why this is checked before falling
 *  back to this app's own standings-based projection. */
export async function getSleeperLeagueDrafts(leagueId: string, opts?: { fresh?: boolean }): Promise<SleeperDraft[]> {
  return (await sleeperGet<SleeperDraft[]>(`/league/${leagueId}/drafts`, opts)) ?? [];
}
