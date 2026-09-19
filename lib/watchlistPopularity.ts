import { query } from "@/lib/db";

const REVALIDATE_SECONDS = 600; // 10 minutes — popularity is a slow-moving signal, unlike scores

// A minimum total population before showing ANY percentage at all.
// With a small number of total active watchlists, one or two people
// adding a player swings the percentage wildly and says nothing
// statistically meaningful — e.g. 1 add out of 5 total watchlists
// reads as "20% watchlist interest," which is noise, not a signal.
const MIN_TOTAL_ACTIVE_WATCHLISTS = 25;
// A minimum raw count for a SPECIFIC player, even once the total
// population is large enough — otherwise a player two people have
// ever watchlisted still shows some tiny, meaningless percentage.
const MIN_PROSPECT_COUNT = 3;

interface PopularitySnapshot {
  totalActiveWatchlists: number;
  countByProspectId: Map<string, number>;
  computedAt: number;
}

let cache: PopularitySnapshot | null = null;
let inFlight: Promise<PopularitySnapshot> | null = null;

async function computeSnapshot(): Promise<PopularitySnapshot> {
  // Two aggregate queries, never anything scoped to an individual
  // user — this is the actual privacy boundary: it is architecturally
  // impossible for this module to reveal who has a given player on
  // their list, because it never reads user_id as an output value,
  // only as the thing being counted.
  const [totalRows, countRows] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(DISTINCT user_id) AS count FROM watchlist_items`),
    query<{ prospect_id: string; count: string }>(
      `SELECT prospect_id, COUNT(DISTINCT user_id) AS count FROM watchlist_items GROUP BY prospect_id`
    ),
  ]);

  const countByProspectId = new Map<string, number>();
  for (const row of countRows) {
    countByProspectId.set(row.prospect_id, Number(row.count));
  }

  return {
    totalActiveWatchlists: Number(totalRows[0]?.count ?? 0),
    countByProspectId,
    computedAt: Date.now(),
  };
}

/**
 * Non-blocking after the first call, same pattern as the photo
 * indices — precomputing every player's count in two queries and
 * caching the result means a player profile page never runs its own
 * aggregation query per request, which is the actual requirement:
 * this can't afford to be an expensive COUNT(...) WHERE prospect_id
 * = $1 on every single page view.
 */
async function getSnapshot(): Promise<PopularitySnapshot> {
  if (cache && Date.now() - cache.computedAt < REVALIDATE_SECONDS * 1000) return cache;
  if (inFlight) return inFlight;

  inFlight = computeSnapshot()
    .then((snapshot) => {
      cache = snapshot;
      return snapshot;
    })
    .catch((err) => {
      console.error("[watchlist-popularity] Failed to compute snapshot:", err);
      // Stale-but-present data is still useful; only a genuinely cold
      // cache (never computed) has nothing to fall back to.
      return cache ?? { totalActiveWatchlists: 0, countByProspectId: new Map(), computedAt: Date.now() };
    })
    .finally(() => {
      inFlight = null;
    });

  // A cold cache is worth a short wait so the very first profile page
  // view after a deploy doesn't just silently omit the stat — the
  // query itself is two cheap aggregations, not a live external
  // fetch, so this resolves quickly in practice.
  return cache ?? inFlight;
}

/**
 * Returns a display-ready popularity percentage for one prospect, or
 * null if it shouldn't be shown at all — either the site-wide sample
 * is too small to be statistically meaningful, or this specific
 * player's own count is too small to be worth surfacing.
 */
export async function getWatchlistPopularity(prospectId: string): Promise<number | null> {
  const snapshot = await getSnapshot();
  if (snapshot.totalActiveWatchlists < MIN_TOTAL_ACTIVE_WATCHLISTS) return null;

  const count = snapshot.countByProspectId.get(prospectId) ?? 0;
  if (count < MIN_PROSPECT_COUNT) return null;

  return Math.round((count / snapshot.totalActiveWatchlists) * 100);
}
