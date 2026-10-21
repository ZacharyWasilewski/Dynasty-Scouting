import { query } from "@/lib/db";
import type { Prospect } from "@/types/prospect";

// How long a detected change stays visible in Trending before it's
// folded into the new resting baseline. Deliberately generous (this
// site updates roughly weekly, not daily) — the goal is "long enough
// that anyone checking in over the next several days still sees it,"
// not "expires by tomorrow."
const DISPLAY_WINDOW_MS = 4 * 24 * 60 * 60 * 1000; // 4 days

export interface ScoreMover {
  id: string;
  name: string;
  position: string;
  school?: string;
  schoolLogoUrl?: string;
  score: number;
  delta: number;
}

type ScoreMap = Record<string, number>;

// Devy prospects only — a drafted player's DD Score is a settled,
// final grade that essentially never changes once calibrated, so
// tracking it here was just dead weight in the comparison, not real
// signal. Pre-Draft Score is the one that actually moves as new
// games/data come in through the season, which is exactly the
// population Trending is meant to surface.
function currentScores(prospects: Prospect[]): ScoreMap {
  const scores: ScoreMap = {};
  for (const p of prospects) {
    if (p.hasDraftData === true) continue;
    if (p.preDraftScore !== undefined) scores[p.id] = p.preDraftScore;
  }
  return scores;
}

function scoresEqual(a: ScoreMap, b: ScoreMap): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((id) => a[id] === b[id]);
}

/**
 * Content-triggered, not timer-triggered — this is the actual fix for
 * a real problem with the first version of this feature: a plain
 * "rotate the baseline every N hours" timer works fine for a site
 * that updates constantly, but this one updates in occasional bursts
 * (weekly-ish). A fixed timer would frequently rotate the baseline
 * during a long quiet stretch and then, by pure bad luck, catch the
 * very next real update and immediately erase it as the new
 * baseline — hiding real changes more often than showing them.
 *
 * Instead: nothing happens at all while scores are unchanged, no
 * matter how much time passes. The moment scores actually differ
 * from the settled baseline, that's captured as "pending" with a
 * timestamp. It stays pending — and Trending keeps showing the diff
 * — for a full DISPLAY_WINDOW_MS regardless of how many refresh
 * cycles pass in between, then only *then* gets folded into the new
 * settled baseline, resetting cleanly for the next real change.
 */
export async function maybeRefreshScoreSnapshot(prospects: Prospect[]): Promise<void> {
  try {
    const rows = await query<{
      settled_scores: ScoreMap | null;
      pending_scores: ScoreMap | null;
      pending_since: string | null;
    }>(`SELECT settled_scores, pending_scores, pending_since FROM score_snapshot WHERE id = 1`);
    const row = rows[0];
    const current = currentScores(prospects);

    // First ever run — nothing to compare against yet, just establish
    // the starting baseline.
    if (!row || !row.settled_scores) {
      await query(
        `INSERT INTO score_snapshot (id, settled_scores, settled_at)
         VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET settled_scores = EXCLUDED.settled_scores, settled_at = EXCLUDED.settled_at`,
        [JSON.stringify(current)]
      );
      console.error(`[trending] Established initial baseline — ${Object.keys(current).length} devy prospects tracked. No movers will show until the next real score change.`);
      return;
    }

    if (scoresEqual(current, row.settled_scores)) {
      // Nothing has changed since the settled baseline — if a pending
      // change had been recorded before but has since reverted back
      // to the settled state (rare, but possible), clear it rather
      // than let a no-longer-real diff keep counting down.
      if (row.pending_scores) {
        await query(`UPDATE score_snapshot SET pending_scores = NULL, pending_since = NULL WHERE id = 1`);
        console.error(`[trending] Pending change reverted back to the settled baseline — cleared.`);
      }
      return;
    }

    // Scores differ from the settled baseline. Is this the same
    // pending change we're already tracking, or a brand new one?
    const isSamePending = row.pending_scores && scoresEqual(current, row.pending_scores);

    if (!isSamePending) {
      // New change — start (or restart) the display window.
      await query(
        `UPDATE score_snapshot SET pending_scores = $1, pending_since = now() WHERE id = 1`,
        [JSON.stringify(current)]
      );
      console.error(`[trending] New change detected vs. settled baseline — display window started, will fold into baseline in ${DISPLAY_WINDOW_MS / (60 * 60 * 1000)}h.`);
      return;
    }

    // Same pending change as last time we checked — has it been
    // visible long enough to fold into the new settled baseline?
    const pendingAgeMs = row.pending_since ? Date.now() - new Date(row.pending_since).getTime() : 0;
    if (pendingAgeMs >= DISPLAY_WINDOW_MS) {
      await query(
        `UPDATE score_snapshot
         SET settled_scores = pending_scores, settled_at = pending_since, pending_scores = NULL, pending_since = NULL
         WHERE id = 1`
      );
      console.error(`[trending] Display window elapsed — pending change folded into new settled baseline.`);
    }
  } catch (err) {
    // Trending is a nice-to-have, never worth failing the whole
    // sheet-data refresh over — the next cycle just tries again.
    console.error("[trending] Failed to refresh score snapshot:", err);
  }
}

/**
 * Movers are always the settled baseline vs. today's live scores —
 * during the DISPLAY_WINDOW_MS after a real change, that's exactly
 * the pending diff (settled hasn't rotated yet); before or after
 * that window, it correctly comes back empty. Returns empty arrays
 * (not an error) if there's no baseline yet, so callers can just
 * render nothing rather than special-case "no data yet" themselves.
 */
export async function getScoreMovers(
  prospects: Prospect[],
  limit = 5,
  // Optional — lets a caller that's already fetching the baseline
  // concurrently (see app/page.tsx) pass the resolved value straight
  // in, instead of this function doing its own internal fetch after
  // the fact. undefined (the normal case for existing callers/tests)
  // falls back to fetching it here exactly as before — this is
  // purely additive, nothing about the default behavior changed.
  prefetchedBaseline?: ScoreMap | null
): Promise<{ risers: ScoreMover[]; fallers: ScoreMover[] }> {
  const baseline = prefetchedBaseline !== undefined ? prefetchedBaseline : await getSettledBaseline();
  if (!baseline) return { risers: [], fallers: [] };

  const current = currentScores(prospects);
  const byId = new Map(prospects.map((p) => [p.id, p]));

  const moves: ScoreMover[] = [];
  for (const [id, score] of Object.entries(current)) {
    const prev = baseline[id];
    if (prev === undefined) continue;
    const delta = score - prev;
    if (delta === 0) continue;
    const p = byId.get(id);
    if (!p) continue;
    moves.push({ id, name: p.name, position: p.position, school: p.school, schoolLogoUrl: p.schoolLogoUrl, score, delta });
  }

  moves.sort((a, b) => b.delta - a.delta);
  const risers = moves.filter((m) => m.delta > 0).slice(0, limit);
  const fallers = moves
    .filter((m) => m.delta < 0)
    .slice(-limit)
    .reverse();

  return { risers, fallers };
}

/**
 * Per-prospect delta lookup — for showing a small "▲ +2.3" style
 * indicator directly on a ranking list row, rather than only in the
 * homepage's curated top-movers list. Same baseline/comparison logic
 * as getScoreMovers, just returned as a flat id -> delta map instead
 * of a sorted, limited top-N list, and without needing the full
 * Prospect object back (callers already have that).
 */
export async function getScoreDeltas(prospects: Prospect[]): Promise<Map<string, number>> {
  const baseline = await getSettledBaseline();
  const deltas = new Map<string, number>();
  if (!baseline) return deltas;

  const current = currentScores(prospects);
  for (const [id, score] of Object.entries(current)) {
    const prev = baseline[id];
    if (prev === undefined) continue;
    const delta = score - prev;
    if (delta !== 0) deltas.set(id, delta);
  }
  return deltas;
}

export async function getSettledBaseline(): Promise<ScoreMap | null> {
  try {
    const rows = await query<{ settled_scores: ScoreMap | null }>(
      `SELECT settled_scores FROM score_snapshot WHERE id = 1`
    );
    return rows[0]?.settled_scores ?? null;
  } catch (err) {
    console.error("[trending] Failed to read score snapshot:", err);
    return null;
  }
}
