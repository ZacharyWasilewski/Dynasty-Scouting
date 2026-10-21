import { query } from "@/lib/db";
import { getProspects } from "@/lib/googleSheets";
import { getDDScore, getDDTier, type LeagueFormat } from "@/lib/ddScore";
import { sendWatchlistNotificationEmail } from "@/lib/email";
import type { Prospect } from "@/types/prospect";

// A DD Score move smaller than this is normal week-to-week model
// noise, not something worth an email — chosen relative to the real
// scale in use: tier boundaries throughout the site (lib/tiers.ts)
// are typically spaced 10+ points apart, so 5 points is meaningfully
// smaller than a full tier jump (which is already caught separately,
// regardless of point distance) while still being well above the
// kind of sub-1-point drift a routine recalculation produces.
const MEANINGFUL_SCORE_DELTA = 5;

const DEFAULT_FORMAT: LeagueFormat = "SUPERFLEX";

interface WatchlistUser {
  userId: string;
  email: string;
  format: LeagueFormat;
  prospectIds: string[];
}

function isLeagueFormat(value: string | null): value is LeagueFormat {
  return value === "1QB" || value === "SUPERFLEX" || value === "1QB_TEP" || value === "SUPERFLEX_TEP";
}

function formatLabel(format: LeagueFormat): string {
  switch (format) {
    case "1QB":
      return "1QB";
    case "SUPERFLEX":
      return "Superflex";
    case "1QB_TEP":
      return "1QB TEP";
    case "SUPERFLEX_TEP":
      return "Superflex TEP";
  }
}

/**
 * Only users who are both opted in AND actually have something on
 * their watchlist — an opted-in user with an empty watchlist has
 * nothing to ever notify about, so excluding them here means the
 * scheduler's later per-prospect work never touches their (nonexistent)
 * data at all.
 */
async function getEligibleUsers(): Promise<WatchlistUser[]> {
  const rows = await query<{ user_id: string; email: string; league_format: string | null; prospect_id: string }>(
    `SELECT np.user_id, u.email, up.league_format, w.prospect_id
     FROM notification_preferences np
     JOIN users u ON u.id = np.user_id
     JOIN watchlist_items w ON w.user_id = np.user_id
     LEFT JOIN user_preferences up ON up.user_id = np.user_id
     WHERE np.watchlist_notifications_enabled = true`
  );

  const byUser = new Map<string, WatchlistUser>();
  for (const row of rows) {
    const format = isLeagueFormat(row.league_format) ? row.league_format : DEFAULT_FORMAT;
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.prospectIds.push(row.prospect_id);
    } else {
      byUser.set(row.user_id, { userId: row.user_id, email: row.email, format, prospectIds: [row.prospect_id] });
    }
  }
  return [...byUser.values()];
}

interface DetectedChange {
  prospectId: string;
  prospectName: string;
  format: LeagueFormat;
  eventType: "tier_change" | "score_change";
  oldValue: string;
  newValue: string;
}

/**
 * The actual run — fetches current data once, diffs every (watchlisted
 * prospect, format actually in use) pair against its stored baseline,
 * sends at most one email per user covering every qualifying change,
 * and always advances the baseline regardless of whether anything
 * notified. Safe to call repeatedly; a run with nothing to do (no
 * opted-in users, or no real changes) is just two cheap queries.
 */
export async function runWatchlistNotificationCheck(): Promise<{ usersNotified: number; changesDetected: number }> {
  const users = await getEligibleUsers();
  if (users.length === 0) return { usersNotified: 0, changesDetected: 0 };

  const prospects = await getProspects();
  const prospectById = new Map(prospects.map((p) => [p.id, p]));

  // Only the (prospect, format) pairs actually in play across every
  // eligible user's watchlist — not every prospect in the database
  // across all four formats, which would be wasted work almost
  // entirely nobody is watching or using.
  const neededPairs = new Map<string, { prospect: Prospect; format: LeagueFormat }>();
  for (const user of users) {
    for (const prospectId of user.prospectIds) {
      const prospect = prospectById.get(prospectId);
      if (!prospect) continue; // watchlisted player no longer in the live dataset
      neededPairs.set(`${prospectId}:${user.format}`, { prospect, format: user.format });
    }
  }
  if (neededPairs.size === 0) return { usersNotified: 0, changesDetected: 0 };

  const uniqueProspectIds = [...new Set([...neededPairs.values()].map((v) => v.prospect.id))];
  const baselineRows = await query<{ prospect_id: string; format: string; tier: string | null; score: string | null }>(
    `SELECT prospect_id, format, tier, score FROM prospect_notification_baseline WHERE prospect_id = ANY($1::text[])`,
    [uniqueProspectIds]
  );
  const baselineByKey = new Map(baselineRows.map((r) => [`${r.prospect_id}:${r.format}`, r]));

  const changesByUser = new Map<string, DetectedChange[]>();
  const baselineUpserts: { prospectId: string; format: LeagueFormat; tier: string | null; score: number | null }[] = [];

  for (const [key, { prospect, format }] of neededPairs) {
    const currentTier = getDDTier(prospect, format) ?? null;
    const currentScore = getDDScore(prospect, format) ?? null;
    const baseline = baselineByKey.get(key);

    baselineUpserts.push({ prospectId: prospect.id, format, tier: currentTier, score: currentScore });

    // No prior baseline row — this prospect/format is new to
    // tracking (either genuinely new, or the very first run after
    // this feature deployed). Record it as the starting point; never
    // treat "no data before" as a change to notify about.
    if (!baseline) continue;

    const changes: DetectedChange[] = [];
    if (baseline.tier !== null && currentTier !== null && baseline.tier !== currentTier) {
      changes.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
        format,
        eventType: "tier_change",
        oldValue: baseline.tier,
        newValue: currentTier,
      });
    }
    const baselineScore = baseline.score !== null ? Number(baseline.score) : null;
    if (baselineScore !== null && currentScore !== null && Math.abs(currentScore - baselineScore) >= MEANINGFUL_SCORE_DELTA) {
      changes.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
        format,
        eventType: "score_change",
        oldValue: baselineScore.toFixed(1),
        newValue: currentScore.toFixed(1),
      });
    }
    if (changes.length === 0) continue;

    for (const user of users) {
      if (user.format !== format || !user.prospectIds.includes(prospect.id)) continue;
      const existing = changesByUser.get(user.userId) ?? [];
      changesByUser.set(user.userId, [...existing, ...changes]);
    }
  }

  // Baseline always advances, whether or not anything was notified —
  // next run's comparison point is always "what we just observed now".
  for (const upsert of baselineUpserts) {
    await query(
      `INSERT INTO prospect_notification_baseline (prospect_id, format, tier, score, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (prospect_id, format) DO UPDATE SET tier = EXCLUDED.tier, score = EXCLUDED.score, updated_at = now()`,
      [upsert.prospectId, upsert.format, upsert.tier, upsert.score]
    );
  }

  let usersNotified = 0;
  let changesDetected = 0;

  for (const user of users) {
    const changes = changesByUser.get(user.userId);
    if (!changes || changes.length === 0) continue;

    // Dedup at the database level: insert every candidate change into
    // the log with ON CONFLICT DO NOTHING, then only email whichever
    // ones actually inserted (weren't already logged for this exact
    // user/prospect/format/event/value combination). This is the real
    // guard against double-sending, not an in-memory check that a
    // concurrent or re-run scheduler invocation could race past.
    const newlyLogged: DetectedChange[] = [];
    for (const change of changes) {
      const result = await query<{ id: number }>(
        `INSERT INTO notification_log (user_id, prospect_id, format, event_type, old_value, new_value)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, prospect_id, format, event_type, new_value) DO NOTHING
         RETURNING id`,
        [user.userId, change.prospectId, change.format, change.eventType, change.oldValue, change.newValue]
      );
      if (result.length > 0) newlyLogged.push(change);
    }
    if (newlyLogged.length === 0) continue;

    changesDetected += newlyLogged.length;
    const result = await sendWatchlistNotificationEmail(
      user.email,
      newlyLogged.map((c) => ({
        prospectName: c.prospectName,
        prospectId: c.prospectId,
        eventType: c.eventType,
        oldValue: c.oldValue,
        newValue: c.newValue,
        format: formatLabel(c.format),
      }))
    );
    if (result.ok) usersNotified++;
  }

  return { usersNotified, changesDetected };
}
