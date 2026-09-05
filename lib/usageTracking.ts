import { query } from "@/lib/db";

/**
 * Records one usage event. Never throws — usage tracking is a
 * nice-to-have that should never be able to break the request it's
 * called from, matching the same defensive pattern used for
 * Trending's own DB writes elsewhere in this codebase.
 */
export async function recordEvent(eventType: string, path: string | null, userId: string | null): Promise<void> {
  try {
    await query(`INSERT INTO usage_events (event_type, path, user_id) VALUES ($1, $2, $3)`, [
      eventType,
      path,
      userId,
    ]);
    // Opportunistic pruning — same "don't need a dedicated cron"
    // reasoning as Trending's snapshot refresh, just probabilistic
    // instead of time-gated, since this fires on every single page
    // view (a time check on every call would itself add overhead;
    // a 1-in-500 chance means it still runs often given real
    // traffic, without adding a query to every single insert). Keeps
    // this an append-mostly table bounded at ~90 days instead of
    // growing forever with data nothing on the site actually reads
    // past that window (the admin view only ever looks at the last
    // 7-30 days).
    if (Math.random() < 1 / 500) {
      await query(`DELETE FROM usage_events WHERE created_at < now() - interval '90 days'`);
    }
  } catch (err) {
    console.error("[usage-tracking] Failed to record event:", err);
  }
}

/**
 * Upserts "last seen on this page" for a user, returning the value
 * from BEFORE this call overwrote it — the whole point of tracking
 * this at all is answering "what changed since they were last here,"
 * which requires reading the old timestamp before it's gone.
 * Returns null for a user's first-ever visit to this page (nothing
 * to compare against) or on any failure — callers should treat null
 * as "don't show a since-last-visit comparison," not an error state.
 */
export async function recordLastSeenAndGetPrevious(userId: string, page: string): Promise<Date | null> {
  try {
    const rows = await query<{ last_seen_at: string }>(
      `SELECT last_seen_at FROM user_last_seen WHERE user_id = $1 AND page = $2`,
      [userId, page]
    );
    const previous = rows[0]?.last_seen_at ? new Date(rows[0].last_seen_at) : null;

    await query(
      `INSERT INTO user_last_seen (user_id, page, last_seen_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET page = EXCLUDED.page, last_seen_at = EXCLUDED.last_seen_at`,
      [userId, page]
    );

    return previous;
  } catch (err) {
    console.error("[usage-tracking] Failed to record last-seen:", err);
    return null;
  }
}

export interface TopPath {
  path: string;
  count: number;
}

export interface EventCount {
  eventType: string;
  count: number;
}

/**
 * Aggregate stats for the admin status page — deliberately small,
 * cheap queries (bounded time window, bounded row count) rather than
 * anything resembling a full analytics dashboard. The goal is just
 * "is anything actually being used," not a BI tool.
 *
 * excludeUserId filters out one specific account's own activity from
 * every number here — for the admin viewing their own dashboard,
 * since their own testing/development traffic isn't representative
 * of real usage and would otherwise skew every stat on the page. The
 * underlying events themselves are still recorded either way (this
 * only affects what gets displayed here), so nothing is lost if this
 * ever needs to be un-excluded or looked at directly.
 */
export async function getUsageSummary(days: number, excludeUserId?: string): Promise<{
  topPaths: TopPath[];
  eventCounts: EventCount[];
  uniqueActiveUsers: number;
  totalEvents: number;
}> {
  try {
    const exclude = excludeUserId ? `AND (user_id IS NULL OR user_id != $2)` : "";
    const params = excludeUserId ? [days, excludeUserId] : [days];

    const [topPathsRows, eventCountRows, activeUsersRows, totalRows] = await Promise.all([
      query<{ path: string; count: string }>(
        `SELECT path, COUNT(*) as count FROM usage_events
         WHERE event_type = 'page_view' AND path IS NOT NULL AND created_at > now() - ($1 || ' days')::interval ${exclude}
         GROUP BY path ORDER BY count DESC LIMIT 10`,
        params
      ),
      query<{ event_type: string; count: string }>(
        `SELECT event_type, COUNT(*) as count FROM usage_events
         WHERE event_type != 'page_view' AND created_at > now() - ($1 || ' days')::interval ${exclude}
         GROUP BY event_type ORDER BY count DESC`,
        params
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id) as count FROM usage_events
         WHERE user_id IS NOT NULL AND created_at > now() - ($1 || ' days')::interval ${exclude}`,
        params
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM usage_events WHERE created_at > now() - ($1 || ' days')::interval ${exclude}`,
        params
      ),
    ]);

    return {
      topPaths: topPathsRows.map((r) => ({ path: r.path, count: Number(r.count) })),
      eventCounts: eventCountRows.map((r) => ({ eventType: r.event_type, count: Number(r.count) })),
      uniqueActiveUsers: Number(activeUsersRows[0]?.count ?? 0),
      totalEvents: Number(totalRows[0]?.count ?? 0),
    };
  } catch (err) {
    console.error("[usage-tracking] Failed to load usage summary:", err);
    return { topPaths: [], eventCounts: [], uniqueActiveUsers: 0, totalEvents: 0 };
  }
}
