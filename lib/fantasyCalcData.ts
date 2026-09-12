import type { CommunityFormatKey, CommunityPlayer } from "@/lib/mockDraft";
import type { CommunitySnapshot } from "@/lib/communityData";
import { reportStatus } from "@/lib/systemStatus";

/**
 * FantasyCalc Community Rankings
 *
 * Source: FantasyCalc's public values API. The API exposes overallRank and
 * player metadata and powers FantasyCalc's rankings. We pull 1QB and
 * Superflex boards independently, then create four mock-draft format boards:
 *   - 1QB / Standard
 *   - 1QB / TE+
 *   - Superflex / Standard
 *   - Superflex / TE+
 *
 * FantasyCalc handles the QB-count dimension through numQbs. It does not
 * expose a separate TE+ rookie ranking in this endpoint, so TE+ uses the
 * project's existing percentile-based TE adjustment after the class is
 * isolated. Standard boards preserve FantasyCalc's class ordering.
 */

const FANTASYCALC_URL = "https://api.fantasycalc.com/values/current";
const DAILY_REVALIDATE_SECONDS = 86_400;
// If a fetch fails or comes back empty, don't wait the full 24h to
// try again — retry on the next request after a few minutes instead,
// while still serving the last known-good values in the meantime.
const RETRY_ON_FAILURE_SECONDS = 5 * 60;
const COLD_START_TIMEOUT_MS = 3000;
const TE_TEP_PERCENTILE_SHIFT = 3;

export type FantasyCalcFormatLists = Record<CommunityFormatKey, CommunitySnapshot>;

interface FantasyCalcPlayer {
  player: {
    name: string;
    position: string;
    maybeYoe?: number;
    maybeAge?: number;
  };
  value: number;
  overallRank: number;
}

export type RawCommunityPlayer = {
  name: string;
  position?: "QB" | "RB" | "WR" | "TE";
  sourceRank: number;
  value: number;
};

function normalizePosition(value: unknown): RawCommunityPlayer["position"] {
  const p = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (p === "QB") return "QB";
  if (p === "RB" || p === "HB") return "RB";
  if (p === "WR") return "WR";
  if (p === "TE") return "TE";
  return undefined;
}

export function normalizeName(name: string): string {
  return name
    .replace(/[®™]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function percentileFromRank(rank: number, total: number): number {
  if (total <= 1) return 100;
  return ((total - rank + 1) / total) * 100;
}

function communityTierFromPercentile(percentile: number): number {
  if (percentile >= 95) return 1;
  if (percentile >= 85) return 2;
  if (percentile >= 75) return 3;
  if (percentile >= 62.5) return 4;
  if (percentile >= 50) return 5;
  if (percentile >= 37.5) return 6;
  if (percentile >= 25) return 7;
  return 8;
}

function isTeFormat(formatKey: CommunityFormatKey): boolean {
  return formatKey === "FC_1QB_TE_PLUS" || formatKey === "FC_SF_TE_PLUS";
}

function numQbsForFormat(formatKey: CommunityFormatKey): 1 | 2 {
  return formatKey === "FC_SF_STANDARD" || formatKey === "FC_SF_TE_PLUS" ? 2 : 1;
}

async function fetchFantasyCalcValuesRaw(numQbs: 1 | 2): Promise<RawCommunityPlayer[]> {
  const url = `${FANTASYCALC_URL}?isDynasty=true&numQbs=${numQbs}&numTeams=12&ppr=1`;
  const response = await fetch(url, {
    next: { revalidate: DAILY_REVALIDATE_SECONDS },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return (data as FantasyCalcPlayer[])
    .filter((row) => row?.player?.name && Number.isFinite(row?.overallRank) && Number.isFinite(row?.value))
    .map((row) => ({
      name: row.player.name,
      position: normalizePosition(row.player.position),
      sourceRank: row.overallRank,
      value: row.value,
    }));
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

interface CachedValues {
  rows: RawCommunityPlayer[];
  expires: number;
}

// Keyed by numQbs (1 or 2) — separate cache/in-flight slot per board,
// since 1QB and Superflex values are two genuinely different fetches.
const valuesCache = new Map<1 | 2, CachedValues>();
const valuesInFlight = new Map<1 | 2, Promise<RawCommunityPlayer[]>>();

/**
 * Cached, stale-tolerant wrapper around the real FantasyCalc fetch.
 * The important behavior: a failed or empty response NEVER overwrites
 * a previously-good cache — it keeps serving the last real values and
 * just retries sooner (RETRY_ON_FAILURE_SECONDS instead of a full
 * day). Without this, a single transient FantasyCalc outage would
 * zero out Community Rankings and Team Sync needs for up to 24 hours,
 * since the plain `next: {revalidate}` fetch cache above only caches
 * successful responses and has no memory of what came before a
 * failure.
 */
export async function fetchFantasyCalcValues(numQbs: 1 | 2): Promise<RawCommunityPlayer[]> {
  const cached = valuesCache.get(numQbs);
  if (cached && cached.expires > Date.now()) return cached.rows;

  const wasNeverFetched = !cached;

  if (!valuesInFlight.has(numQbs)) {
    const promise = fetchFantasyCalcValuesRaw(numQbs)
      .then((rows) => {
        const prev = valuesCache.get(numQbs);
        if (rows.length > 0 || !prev) {
          valuesCache.set(numQbs, { rows, expires: Date.now() + DAILY_REVALIDATE_SECONDS * 1000 });
          reportStatus(`fantasycalc-${numQbs}qb`, "ok", `${rows.length} player values loaded`);
        } else {
          // Empty/failed fetch, but a good cache already exists —
          // keep serving it, just come back sooner.
          valuesCache.set(numQbs, { rows: prev.rows, expires: Date.now() + RETRY_ON_FAILURE_SECONDS * 1000 });
          reportStatus(`fantasycalc-${numQbs}qb`, "stale", `Fetch came back empty — still serving ${prev.rows.length} cached values`);
        }
        return valuesCache.get(numQbs)!.rows;
      })
      .catch(() => {
        const prev = valuesCache.get(numQbs);
        valuesCache.set(numQbs, { rows: prev?.rows ?? [], expires: Date.now() + RETRY_ON_FAILURE_SECONDS * 1000 });
        reportStatus(`fantasycalc-${numQbs}qb`, "error", `Fetch failed — still serving ${prev?.rows.length ?? 0} cached values`);
        return valuesCache.get(numQbs)!.rows;
      })
      .finally(() => {
        valuesInFlight.delete(numQbs);
      });
    valuesInFlight.set(numQbs, promise);
  }

  const inFlight = valuesInFlight.get(numQbs)!;
  if (wasNeverFetched) {
    return withTimeout(inFlight, COLD_START_TIMEOUT_MS, []);
  }
  // Stale-while-revalidate: serve the current (possibly stale) cache
  // immediately, let the refresh finish in the background.
  return cached?.rows ?? (await inFlight);
}

function buildSnapshot(
  classYear: string,
  formatKey: CommunityFormatKey,
  rows: RawCommunityPlayer[],
): CommunitySnapshot {
  const applyTep = isTeFormat(formatKey);
  const ordered = [...rows].sort((a, b) => a.sourceRank - b.sourceRank);

  const percentileByName = new Map<string, number>();
  ordered.forEach((row, index) => {
    percentileByName.set(normalizeName(row.name), percentileFromRank(index + 1, ordered.length));
  });

  const adjusted = ordered.map((row, index) => {
    const basePercentile = percentileFromRank(index + 1, ordered.length);
    const percentile = applyTep && row.position === "TE"
      ? Math.min(100, basePercentile + TE_TEP_PERCENTILE_SHIFT)
      : basePercentile;
    return { ...row, percentile };
  });

  adjusted.sort((a, b) => {
    if (applyTep && b.percentile !== a.percentile) return b.percentile - a.percentile;
    return a.sourceRank - b.sourceRank;
  });

  const players: Record<string, CommunityPlayer> = {};
  adjusted.forEach((row, index) => {
    players[normalizeName(row.name)] = {
      // Preserve FantasyCalc's published rank. The mock UI must not compress
      // the rookie subset into a new 1..N ranking for standard boards.
      rank: row.sourceRank,
      sourceRank: row.sourceRank,
      value: row.value,
      tier: communityTierFromPercentile(row.percentile),
      eligibleYear: classYear,
    };
  });

  return {
    source: "fantasycalc",
    classYear,
    formatKey,
    fetchedAt: new Date().toISOString(),
    players,
  };
}

export async function getLiveFantasyCalcRankings(classYear: string): Promise<FantasyCalcFormatLists> {
  // classYear is retained in the snapshot for source attribution; the API's
  // player pool is filtered to the current class in the client using the
  // Dynasty Database class roster, then re-ranked from #1.
  void classYear;

  const [oneQb, superflex] = await Promise.all([
    fetchFantasyCalcValues(1),
    fetchFantasyCalcValues(2),
  ]);

  return {
    FC_1QB_STANDARD: buildSnapshot(classYear, "FC_1QB_STANDARD", oneQb),
    FC_1QB_TE_PLUS: buildSnapshot(classYear, "FC_1QB_TE_PLUS", oneQb),
    FC_SF_STANDARD: buildSnapshot(classYear, "FC_SF_STANDARD", superflex),
    FC_SF_TE_PLUS: buildSnapshot(classYear, "FC_SF_TE_PLUS", superflex),
  };
}

// ---- Draft pick values (for Team Sync's total-team-value grade) ----
//
// IMPORTANT CAVEAT, stated plainly rather than buried: FantasyCalc
// doesn't publish a documented schema for how draft picks appear in
// this same /values/current response, and this couldn't be verified
// against a live response while building it (no network access to
// inspect the raw JSON directly, only this app's own already-working
// server-side fetch). This extraction is a best-effort, defensive
// guess — lenient name-pattern matching ("2027 1st", "2027 Early
// 1st", etc.) against the exact same rows already used for players,
// so it can never break player-value fetching even if it's wrong
// about picks specifically. If the pattern doesn't match anything in
// production, this returns an empty result (logged clearly) and pick
// value silently contributes $0 rather than crashing anything —
// check the "[fantasycalc-picks]" log line after deploying to see
// whether this actually found real pick entries or needs adjusting.
const PICK_NAME_PATTERN = /^(\d{4})\s+(?:(Early|Mid|Late)\s+)?(1st|2nd|3rd|4th)/i;
const ROUND_FROM_LABEL: Record<string, number> = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 };

/** "ANY" means FantasyCalc gave one blended value for the whole
 *  round rather than splitting by slot — used as a fallback when no
 *  tier-specific entry exists for a given round (common for later
 *  rounds, where slot position within the round matters much less
 *  than in round 1). */
export type PickTier = "EARLY" | "MID" | "LATE" | "ANY";

export interface PickValue {
  season: string;
  round: number;
  tier: PickTier;
  value: number;
}

async function fetchFantasyCalcPickValuesRaw(numQbs: 1 | 2): Promise<PickValue[]> {
  const url = `${FANTASYCALC_URL}?isDynasty=true&numQbs=${numQbs}&numTeams=12&ppr=1`;
  let response: Response;
  try {
    response = await fetch(url, {
      next: { revalidate: DAILY_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  // Multiple rows can still share the exact same (season, round,
  // tier) — averaged defensively, same reasoning as elsewhere in
  // this file: better to blend duplicates than silently drop data.
  const bySlot = new Map<string, number[]>();
  for (const row of data as FantasyCalcPlayer[]) {
    const name = row?.player?.name;
    if (!name || !Number.isFinite(row?.value)) continue;
    const match = PICK_NAME_PATTERN.exec(name);
    if (!match) continue;
    const [, season, tierLabel, roundLabel] = match;
    if (!season || !roundLabel) continue;
    const round = ROUND_FROM_LABEL[roundLabel.toLowerCase()];
    if (!round) continue;
    const tier: PickTier = tierLabel ? (tierLabel.toUpperCase() as PickTier) : "ANY";
    const key = `${season}|${round}|${tier}`;
    const existing = bySlot.get(key) ?? [];
    existing.push(row.value);
    bySlot.set(key, existing);
  }

  return [...bySlot.entries()].map(([key, values]) => {
    const [season, roundStr, tier] = key.split("|");
    return {
      season: season as string,
      round: Number(roundStr),
      tier: tier as PickTier,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    };
  });
}

const pickValuesCache = new Map<1 | 2, { entries: PickValue[]; expires: number }>();
const pickValuesInFlight = new Map<1 | 2, Promise<PickValue[]>>();

/** Same stale-if-error caching shape as fetchFantasyCalcValues — a
 *  failed or empty fetch never wipes out a previously-good cache. */
export async function fetchFantasyCalcPickValues(numQbs: 1 | 2): Promise<PickValue[]> {
  const cached = pickValuesCache.get(numQbs);
  if (cached && cached.expires > Date.now()) return cached.entries;

  if (!pickValuesInFlight.has(numQbs)) {
    const promise = fetchFantasyCalcPickValuesRaw(numQbs)
      .then((entries) => {
        const prev = pickValuesCache.get(numQbs);
        if (entries.length > 0 || !prev) {
          pickValuesCache.set(numQbs, { entries, expires: Date.now() + DAILY_REVALIDATE_SECONDS * 1000 });
          console.error(`[fantasycalc-picks] ${entries.length} pick value slots found (${numQbs}QB) — sample: ${entries.slice(0, 6).map((e) => `${e.season} R${e.round} ${e.tier}=${Math.round(e.value)}`).join(", ") || "none"}`);
        } else {
          pickValuesCache.set(numQbs, { entries: prev.entries, expires: Date.now() + RETRY_ON_FAILURE_SECONDS * 1000 });
        }
        return pickValuesCache.get(numQbs)!.entries;
      })
      .catch(() => {
        const prev = pickValuesCache.get(numQbs);
        pickValuesCache.set(numQbs, { entries: prev?.entries ?? [], expires: Date.now() + RETRY_ON_FAILURE_SECONDS * 1000 });
        return pickValuesCache.get(numQbs)!.entries;
      })
      .finally(() => {
        pickValuesInFlight.delete(numQbs);
      });
    pickValuesInFlight.set(numQbs, promise);
  }

  const inFlight = pickValuesInFlight.get(numQbs)!;
  return cached?.entries ?? (await inFlight);
}
