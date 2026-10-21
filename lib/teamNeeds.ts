import type { Prospect, Position } from "@/types/prospect";
import type { RosterPlayerInfo } from "@/lib/playerPhotos";
import type { SleeperRoster, SleeperTradedPick } from "@/lib/sleeper";
import { getSleeperTradedPicks } from "@/lib/sleeper";
import { getScoreForFormat, getTierForFormat, type MockQBFormat } from "@/lib/mockDraft";
import { fetchFantasyCalcValues, fetchFantasyCalcPickValues, type PickValue, type PickTier } from "@/lib/fantasyCalcData";
import { normalizeNameLoose } from "@/lib/schoolLookup";
import { reportHealthEvent } from "@/lib/systemStatus";

const SKILL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
// The two devy classes this app actually tracks/grades — see the
// Hero badge elsewhere in the app ("2027 Draft Cycle") — so pick
// value only covers picks that are meaningful to this site's own
// scope, not every hypothetical future season a league might nominally
// track.
const TRACKED_PICK_SEASONS = ["2027", "2028"];
const PICK_ROUNDS = [1, 2, 3, 4];

export interface PositionNeed {
  position: Position;
  rosteredCount: number;
  /** Total FantasyCalc dynasty value of this team's rostered players
   *  at this position — the actual "need" signal, not headcount. */
  totalValue: number;
  /** This position's average total value across every team in the
   *  league, for context ("you're at 4,200, league average is 6,800"). */
  leagueAvgValue: number;
  /** Where this team's totalValue ranks among every team in the
   *  league at this position, 0-100 (100 = strongest team in the
   *  league here, 0 = weakest). This is the real need signal. */
  percentile: number;
  /** Derived from percentile (66 - percentile, floored at 0) — a
   *  team above the 66th percentile at a position is considered
   *  genuinely stocked there, not just "average or better." Below
   *  that line, needScore is positive and existing "needScore > 0" /
   *  sort-by-needScore-desc consumers keep working unchanged. */
  needScore: number;
}

export interface RosteredPlayer extends RosterPlayerInfo {
  playerId: string;
}

export interface TeamNeedsResult {
  format: MockQBFormat;
  roster: RosteredPlayer[];
  needs: PositionNeed[];
  recommendations: { position: Position; need: PositionNeed; prospects: Prospect[] }[];
}

// Same suffix-stripping normalization used everywhere else in this
// app for cross-source name matching (Sleeper vs. ESPN vs. this
// site's own sheet) — FantasyCalc's "Marvin Harrison Jr." and
// Sleeper's own full_name for the same player otherwise miss each
// other on an exact string match.
function matchKey(name: string): string {
  return normalizeNameLoose(name).replace(/\s+(jr|sr|ii|iii|iv|v)$/, "");
}

/**
 * Whether a league's scoring counts as TE Premium — a tight end's
 * total points per reception exceeds 1.0.
 *
 * IMPORTANT CAVEAT, stated plainly: Sleeper doesn't publish a formal
 * schema for scoring_settings, so the exact field name for a TE-
 * specific reception bonus (bonus_rec_te, additive on top of the
 * league's base `rec` value) is inferred from naming-convention
 * evidence (Sleeper's own WR equivalent is documented elsewhere as
 * bonus_rec_wr) rather than confirmed against a real API response.
 * If this misdetects in practice, the fix is a one-line field-name
 * change here — check the "[team-sync] TEP detection" log line
 * after this ships to confirm what a real league's scoring_settings
 * actually contains.
 */
export function isTepLeague(scoringSettings: Record<string, number> | undefined): boolean {
  if (!scoringSettings) return false;
  const baseRec = scoringSettings.rec ?? 0;
  const teBonus = scoringSettings.bonus_rec_te ?? 0;
  return baseRec + teBonus > 1.0;
}

/**
 * Draft slot per roster (1 = picks first, N = picks last) using the
 * standard dynasty convention — worst record picks first. Wins
 * ascending, tiebroken by points-for ascending (fewer points is
 * treated as "worse" for tiebreak purposes, a reasonable default
 * when two teams tie on wins).
 */
export function computeDraftSlots(allRosters: SleeperRoster[]): Map<number, number> {
  const sorted = [...allRosters].sort((a, b) => {
    const winsA = a.settings?.wins ?? 0;
    const winsB = b.settings?.wins ?? 0;
    if (winsA !== winsB) return winsA - winsB;
    const fptsA = a.settings?.fpts ?? 0;
    const fptsB = b.settings?.fpts ?? 0;
    return fptsA - fptsB;
  });
  const slots = new Map<number, number>();
  sorted.forEach((r, i) => slots.set(r.roster_id, i + 1));
  return slots;
}

/**
 * Buckets a draft slot into Early/Mid/Late thirds of the league —
 * e.g. in a 12-team league, slots 1-4 are Early, 5-8 Mid, 9-12 Late.
 * Generalized proportionally for other league sizes rather than
 * hardcoding to exactly 12.
 */
export function tierForSlot(slot: number, totalTeams: number): PickTier {
  const third = Math.ceil(totalTeams / 3);
  if (slot <= third) return "EARLY";
  if (slot <= third * 2) return "MID";
  return "LATE";
}

export function getPickValue(pickValues: PickValue[], season: string, round: number, tier: PickTier): number {
  const exact = pickValues.find((p) => p.season === season && p.round === round && p.tier === tier);
  if (exact) return exact.value;
  // Fall back to a blended whole-round value if FantasyCalc didn't
  // split this particular round by tier (common for rounds 2-4,
  // where slot position matters far less than in round 1).
  const blended = pickValues.find((p) => p.season === season && p.round === round && p.tier === "ANY");
  return blended?.value ?? 0;
}

export interface OwnedPick {
  season: string;
  round: number;
  /** Whose regular-season finish determines this pick's actual draft
   *  slot — the original owner, not necessarily who holds it now. */
  originalRosterId: number;
}

/**
 * Every pick a roster currently owns across the tracked seasons/
 * rounds — starts from "everyone owns their own picks by default,"
 * then applies each trade on top. Sleeper's traded_picks endpoint
 * already resolves multi-hop trade chains to a single current owner
 * per entry, so this never needs to walk a chain manually.
 */
export function computeOwnedPicks(myRosterId: number, tradedPicks: SleeperTradedPick[]): OwnedPick[] {
  const owned = new Map<string, boolean>();
  for (const season of TRACKED_PICK_SEASONS) {
    for (const round of PICK_ROUNDS) {
      owned.set(`${season}|${round}|${myRosterId}`, true);
    }
  }
  for (const trade of tradedPicks) {
    if (!TRACKED_PICK_SEASONS.includes(trade.season)) continue;
    const key = `${trade.season}|${trade.round}|${trade.roster_id}`;
    if (trade.roster_id === myRosterId && trade.owner_id !== myRosterId) {
      owned.set(key, false); // traded my own pick away
    }
    if (trade.owner_id === myRosterId && trade.roster_id !== myRosterId) {
      owned.set(key, true); // acquired someone else's pick
    }
  }
  const result: OwnedPick[] = [];
  for (const [key, isOwned] of owned) {
    if (!isOwned) continue;
    const [season, roundStr, originalRosterIdStr] = key.split("|");
    result.push({ season: season as string, round: Number(roundStr), originalRosterId: Number(originalRosterIdStr) });
  }
  return result;
}

export function valueOwnedPicks(
  owned: OwnedPick[],
  draftSlots: Map<number, number>,
  pickValues: PickValue[],
  totalTeams: number
): number {
  let total = 0;
  for (const pick of owned) {
    const slot = draftSlots.get(pick.originalRosterId);
    const tier = slot !== undefined ? tierForSlot(slot, totalTeams) : "ANY";
    total += getPickValue(pickValues, pick.season, pick.round, tier);
  }
  return total;
}

function resolveRoster(playerIds: string[] | null, sleeperIndex: Map<string, RosterPlayerInfo>): RosteredPlayer[] {
  return (playerIds ?? [])
    .map((id) => {
      const info = sleeperIndex.get(id);
      return info ? { ...info, playerId: id } : null;
    })
    .filter((p): p is RosteredPlayer => p !== null);
}

function totalValueByPosition(
  roster: RosteredPlayer[],
  valueIndex: Map<string, number>
): { totals: Record<Position, number>; unmatched: RosteredPlayer[] } {
  const totals: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 } as Record<Position, number>;
  const unmatched: RosteredPlayer[] = [];
  for (const p of roster) {
    if (!SKILL_POSITIONS.includes(p.position as Position)) continue;
    const value = valueIndex.get(matchKey(p.name));
    if (value === undefined) {
      unmatched.push(p);
    } else {
      totals[p.position as Position] += value;
    }
  }
  return { totals, unmatched };
}

/**
 * Resolves every roster in the league against real FantasyCalc
 * dynasty values, then ranks the user's team against their actual
 * league-mates at each position — quality (trade value), not
 * headcount, and relative to this specific league rather than a
 * fixed generic scale. A team with 2 elite RBs correctly reads as
 * fine at RB even with fewer bodies than a league-mate hoarding
 * bench depth; needScore stays 0 unless a position is genuinely
 * below the league's own average there.
 */
export async function computeValueBasedNeeds(
  leagueId: string,
  allRosters: SleeperRoster[],
  myRosterId: number,
  sleeperIndex: Map<string, RosterPlayerInfo>,
  rosterPositions: string[]
): Promise<{
  format: MockQBFormat;
  roster: RosteredPlayer[];
  needs: PositionNeed[];
  myTotalValue: number;
  leagueTotalValues: number[];
  myPickValue: number;
  pickPercentile: number;
}> {
  const isSuperflex = rosterPositions.includes("SUPER_FLEX");
  const format: MockQBFormat = isSuperflex ? "SUPERFLEX" : "1QB";
  const numQbs = isSuperflex ? 2 : 1;

  const [fcRows, pickValues, tradedPicks] = await Promise.all([
    fetchFantasyCalcValues(numQbs),
    fetchFantasyCalcPickValues(numQbs),
    // fresh: true — same reasoning as Mock Draft's real pick order:
    // a stale trade snapshot here would misreport who actually owns
    // a pick, not just approximate its value.
    getSleeperTradedPicks(leagueId, { fresh: true }),
  ]);
  const valueIndex = new Map<string, number>();
  for (const row of fcRows) {
    valueIndex.set(matchKey(row.name), row.value);
  }

  const myRoster = resolveRoster(allRosters.find((r) => r.roster_id === myRosterId)?.players ?? null, sleeperIndex);
  const draftSlots = computeDraftSlots(allRosters);
  const totalTeams = allRosters.length;
  const { totals: myTotals, unmatched: myUnmatched } = totalValueByPosition(myRoster, valueIndex);

  // Every team's positional total, so the user's number means
  // something relative to this actual league instead of a fixed
  // scale that doesn't know if it's a 10-team or 14-team format.
  // Reuses myTotals (just computed above) for the user's own roster
  // rather than resolving and re-summing the exact same roster a
  // second time.
  const leagueTotals = allRosters.map((r) =>
    r.roster_id === myRosterId ? myTotals : totalValueByPosition(resolveRoster(r.players, sleeperIndex), valueIndex).totals
  );

  // Same class of bug this app hit repeatedly with ESPN/Sleeper name
  // matching — a rostered player whose FantasyCalc value can't be
  // found silently counts as worth $0, which would make a team look
  // like it needs a position it's actually fine at. Scoped to just
  // the user's own roster (not all ~10-14 teams in the league) to
  // keep this from being noisy on every request.
  if (myUnmatched.length > 0) {
    const msg = `Team Sync: ${myUnmatched.length} rostered player(s) had no FantasyCalc value match (counted as $0): ${myUnmatched.map((p) => `${p.name} (${p.position}) [key: ${matchKey(p.name)}]`).join(" | ")}`;
    console.error(`[team-sync] ${msg}`);
    reportHealthEvent(msg);
  }

  const counts: Partial<Record<Position, number>> = {};
  for (const p of myRoster) {
    if (!SKILL_POSITIONS.includes(p.position as Position)) continue;
    const pos = p.position as Position;
    counts[pos] = (counts[pos] ?? 0) + 1;
  }

  const needs: PositionNeed[] = SKILL_POSITIONS.map((position) => {
    const myValue = myTotals[position];
    const allValues = leagueTotals.map((t) => t[position]);
    const leagueAvgValue = allValues.length > 0 ? allValues.reduce((s, v) => s + v, 0) / allValues.length : 0;
    // Percentile via rank among all teams (including this one) —
    // teams strictly worse than this one, as a share of the league.
    const worseCount = allValues.filter((v) => v < myValue).length;
    const percentile = allValues.length > 1 ? Math.round((worseCount / (allValues.length - 1)) * 100) : 100;
    const needScore = Math.max(0, 66 - percentile);
    return {
      position,
      rosteredCount: counts[position] ?? 0,
      totalValue: Math.round(myValue),
      leagueAvgValue: Math.round(leagueAvgValue),
      percentile,
      needScore,
    };
  }).sort((a, b) => b.needScore - a.needScore);

  // Pick value computed once per team here (not just for the user),
  // both to feed the combined roster+picks total for
  // computeOverallGrade, and to expose picks as their own
  // percentile-ranked line item — same treatment every position
  // already gets, so "how good are my picks specifically" isn't
  // buried inside one blended number with no visibility into it.
  const leaguePickValues = allRosters.map((r) => valueOwnedPicks(computeOwnedPicks(r.roster_id, tradedPicks), draftSlots, pickValues, totalTeams));
  const myIndex = allRosters.findIndex((r) => r.roster_id === myRosterId);
  const myPickValue = leaguePickValues[myIndex] ?? 0;

  const pickWorseCount = leaguePickValues.filter((v) => v < myPickValue).length;
  const pickPercentile = leaguePickValues.length > 1
    ? Math.round((pickWorseCount / (leaguePickValues.length - 1)) * 100)
    : 100;

  const myTotalValue = SKILL_POSITIONS.reduce((sum, pos) => sum + myTotals[pos], 0) + myPickValue;
  const leagueTotalValues = allRosters.map((r, i) => {
    const rosterValue = SKILL_POSITIONS.reduce((sum, pos) => sum + (leagueTotals[i]?.[pos] ?? 0), 0);
    return rosterValue + (leaguePickValues[i] ?? 0);
  });

  return {
    format,
    roster: myRoster,
    needs,
    myTotalValue,
    leagueTotalValues,
    myPickValue,
    pickPercentile,
  };
}

export interface RealDraftPick {
  overall: number;
  round: number;
  /** Standings-based position within the round (1 = worst record,
   *  picks first) — this is NOT necessarily who currently owns the
   *  pick, just whose record determined the slot. */
  slot: number;
  /** Who actually owns this pick right now, after trades. */
  ownerRosterId: number;
}

/**
 * The full real draft order for one season, every round, with actual
 * current ownership after trades — this is what lets Mock Draft
 * reflect a real league's actual pick situation instead of assuming
 * everyone owns a clean, untraded slot. Reuses the exact same
 * ownership-reconciliation logic as computeOwnedPicks (which answers
 * "what does roster X own" for the whole tracked window) — this
 * answers the complementary question, "who owns every pick this
 * round," which is what a full mock draft order actually needs.
 */
export function computeRealDraftOrder(
  allRosters: SleeperRoster[],
  tradedPicks: SleeperTradedPick[],
  season: string,
  rounds: number = PICK_ROUNDS.length,
  /** Overrides the standings-derived slot mapping with an
   *  authoritative one — used when Sleeper's own draft object
   *  already has a real draft_order set (see the caller in
   *  app/api/sleeper/route.ts), which is more trustworthy than this
   *  app's own standings-based projection whenever it exists. */
  slotToRosterIdOverride?: Map<number, number>
): RealDraftPick[] {
  let slotToRosterId: Map<number, number>;
  if (slotToRosterIdOverride) {
    slotToRosterId = slotToRosterIdOverride;
  } else {
    const draftSlots = computeDraftSlots(allRosters);
    slotToRosterId = new Map<number, number>();
    for (const [rosterId, slot] of draftSlots) slotToRosterId.set(slot, rosterId);
  }

  const teams = allRosters.length;
  const picks: RealDraftPick[] = [];

  for (let round = 1; round <= rounds; round++) {
    for (let slot = 1; slot <= teams; slot++) {
      const originalRosterId = slotToRosterId.get(slot);
      if (originalRosterId === undefined) continue;

      const trade = tradedPicks.find(
        (t) => t.season === season && t.round === round && t.roster_id === originalRosterId
      );
      const ownerRosterId = trade ? trade.owner_id : originalRosterId;

      picks.push({ overall: (round - 1) * teams + slot, round, slot, ownerRosterId });
    }
  }

  return picks;
}

export interface OverallGrade {
  grade: string;
  percentile: number;
}

/**
 * One letter grade summarizing the team as a whole — total dynasty
 * value across all four skill positions PLUS owned draft picks,
 * percentile-ranked against every other real team in this league.
 * This replaced an earlier version that averaged the four position
 * percentiles instead: that rewarded being balanced-but-mediocre
 * everywhere over being genuinely stacked in aggregate, and ignored
 * draft-pick capital entirely — a team that traded its whole roster
 * for a stack of future 1sts scored as weak, when in dynasty terms
 * it's often exactly the opposite.
 */
export function computeOverallGrade(myTotalValue: number, leagueTotalValues: number[]): OverallGrade {
  const worseCount = leagueTotalValues.filter((v) => v < myTotalValue).length;
  const percentile = leagueTotalValues.length > 1
    ? Math.round((worseCount / (leagueTotalValues.length - 1)) * 100)
    : 100;

  // The 50th percentile (a perfectly average team) lands in the C
  // range on purpose — this is a grade relative to league-mates, not
  // an absolute score, so "average" should read as literally average,
  // not as a near-failing grade the way it would on a 0-100 school
  // scale centered around ~70.
  let grade: string;
  if (percentile >= 90) grade = "A+";
  else if (percentile >= 80) grade = "A";
  else if (percentile >= 70) grade = "B+";
  else if (percentile >= 60) grade = "B";
  else if (percentile >= 50) grade = "C+";
  else if (percentile >= 40) grade = "C";
  else if (percentile >= 30) grade = "D+";
  else if (percentile >= 20) grade = "D";
  else grade = "F";

  return { grade, percentile };
}

/**
 * Pulls recommended future-draft targets for each position with a
 * real need — restricted to prospects who haven't been drafted to
 * the NFL yet (hasDraftData !== true), since "future draft
 * recommendations" means devy/rookie-class prospects, not the
 * historical backtest data that also lives in this same dataset.
 */
export function buildRecommendations(
  prospects: Prospect[],
  needs: PositionNeed[],
  format: MockQBFormat,
  perPosition = 6
): TeamNeedsResult["recommendations"] {
  const future = prospects.filter((p) => p.hasDraftData !== true);

  return needs
    .filter((n) => n.needScore > 0)
    .map((need) => {
      const atPosition = future
        .filter((p) => p.position === need.position)
        .map((p) => ({ p, score: getScoreForFormat(p, format, "STANDARD") }))
        .filter((x) => x.score !== undefined)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, perPosition)
        .map((x) => x.p);
      return { position: need.position, need, prospects: atPosition };
    })
    .filter((group) => group.prospects.length > 0);
}

export { getTierForFormat };
