import crypto from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  getSleeperUser,
  getSleeperLeagues,
  getSleeperLeague,
  getSleeperRosters,
  getSleeperLeagueUsers,
  getSleeperTradedPicks,
  getSleeperLeagueDrafts,
} from "@/lib/sleeper";
import { getSleeperPlayerIndexIfReady } from "@/lib/playerPhotos";
import { computeValueBasedNeeds, buildRecommendations, computeOverallGrade, computeRealDraftOrder, isTepLeague } from "@/lib/teamNeeds";
import { getMoversAtNeeds } from "@/lib/needsDigest";
import { getProspects } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

async function requireUser() {
  // Team Sync is an account-only feature — the client already gates
  // the whole page behind login, but that's a UI convenience, not
  // security. Enforcing it here too means the endpoint itself can't
  // be hit directly by someone logged out.
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  const rl = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to use Team Sync." }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "saved") {
    const rows = await query<{
      id: string;
      league_id: string;
      roster_id: number;
      league_name: string;
      team_name: string;
      updated_at: string;
    }>(
      `SELECT id, league_id, roster_id, league_name, team_name, updated_at
       FROM synced_sleeper_teams WHERE user_id = $1 ORDER BY updated_at DESC`,
      [user.id]
    );
    return NextResponse.json({
      teams: rows.map((r) => ({
        id: r.id,
        leagueId: r.league_id,
        rosterId: r.roster_id,
        leagueName: r.league_name,
        teamName: r.team_name,
        updatedAt: r.updated_at,
      })),
    });
  }

  if (action === "leagues") {
    const username = url.searchParams.get("username")?.trim();
    if (!username) {
      return NextResponse.json({ error: "Missing username." }, { status: 400 });
    }
    const sleeperUser = await getSleeperUser(username);
    if (!sleeperUser) {
      return NextResponse.json({ error: `No Sleeper user found for "${username}".` }, { status: 404 });
    }
    const leagues = await getSleeperLeagues(sleeperUser.user_id);
    return NextResponse.json({
      leagues: leagues.map((l) => ({ leagueId: l.league_id, name: l.name, season: l.season })),
    });
  }

  // Given just a league ID (the more reliable path — always visible
  // in the Sleeper app/URL, unlike a login username people often
  // don't remember), returns the league name plus every team in it
  // so the person can pick which roster is theirs. This is also
  // where the "leagues" flow above lands after picking a league —
  // one shared step either way, since a username alone still can't
  // tell us which of a league's several rosters belongs to them.
  if (action === "teams") {
    const leagueId = url.searchParams.get("leagueId")?.trim();
    if (!leagueId) {
      return NextResponse.json({ error: "Missing leagueId." }, { status: 400 });
    }
    const [league, rosters, leagueUsers] = await Promise.all([
      getSleeperLeague(leagueId),
      getSleeperRosters(leagueId),
      getSleeperLeagueUsers(leagueId),
    ]);
    if (!league) {
      return NextResponse.json({ error: "No league found for that ID." }, { status: 404 });
    }
    const usersById = new Map(leagueUsers.map((u) => [u.user_id, u]));
    const teams = rosters.map((r) => {
      const owner = r.owner_id ? usersById.get(r.owner_id) : undefined;
      return {
        rosterId: r.roster_id,
        teamName: owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`,
      };
    });
    return NextResponse.json({ leagueId, leagueName: league.name, teams });
  }

  if (action === "needs") {
    const leagueId = url.searchParams.get("leagueId")?.trim();
    const rosterId = url.searchParams.get("rosterId");
    if (!leagueId || !rosterId) {
      return NextResponse.json({ error: "Missing leagueId or rosterId." }, { status: 400 });
    }

    const [league, rosters, leagueUsers, sleeperIndex, prospects] = await Promise.all([
      getSleeperLeague(leagueId),
      getSleeperRosters(leagueId),
      getSleeperLeagueUsers(leagueId),
      getSleeperPlayerIndexIfReady(),
      getProspects(),
    ]);

    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    const myRoster = rosters.find((r) => String(r.roster_id) === rosterId);
    if (!myRoster) {
      return NextResponse.json({ error: "Couldn't find that team in this league." }, { status: 404 });
    }
    const myUser = myRoster.owner_id ? leagueUsers.find((u) => u.user_id === myRoster.owner_id) : undefined;

    const { format, roster, needs, myTotalValue, leagueTotalValues, myPickValue, pickPercentile } = await computeValueBasedNeeds(
      leagueId,
      rosters,
      myRoster.roster_id,
      sleeperIndex,
      league.roster_positions ?? []
    );
    const recommendations = buildRecommendations(prospects, needs, format);
    const overallGrade = computeOverallGrade(myTotalValue, leagueTotalValues);
    const moversAtNeeds = await getMoversAtNeeds(prospects, needs);
    const teFormat = isTepLeague(league.scoring_settings) ? "TEP" : "STANDARD";
    console.error(`[team-sync] TEP detection for league ${leagueId}: rec=${league.scoring_settings?.rec ?? "unset"}, bonus_rec_te=${league.scoring_settings?.bonus_rec_te ?? "unset"} → ${teFormat}`);

    return NextResponse.json({
      leagueName: league.name,
      teamName: myUser?.metadata?.team_name || myUser?.display_name || "Your Team",
      format,
      teFormat,
      roster,
      needs,
      recommendations,
      overallGrade,
      moversAtNeeds,
      pickValue: Math.round(myPickValue),
      pickPercentile,
    }, { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } });
  }

  if (action === "draft-order") {
    const leagueId = url.searchParams.get("leagueId")?.trim();
    const rosterId = url.searchParams.get("rosterId");
    const season = url.searchParams.get("season")?.trim();
    const roundsParam = Number(url.searchParams.get("rounds"));
    const rounds = Number.isFinite(roundsParam) && roundsParam > 0 ? Math.min(roundsParam, 10) : 4;

    if (!leagueId || !rosterId || !season) {
      return NextResponse.json({ error: "Missing leagueId, rosterId, or season." }, { status: 400 });
    }

    // fresh: true on all four — this feature tells someone which
    // exact picks they own, so a stale trade, stale standings
    // snapshot, or stale draft object isn't a minor tradeoff here,
    // it's actively wrong information (confirmed in production: a
    // pick shown as owned that the real team didn't actually have by
    // draft day).
    const [league, rosters, leagueUsers, tradedPicks, drafts] = await Promise.all([
      getSleeperLeague(leagueId, { fresh: true }),
      getSleeperRosters(leagueId, { fresh: true }),
      getSleeperLeagueUsers(leagueId),
      getSleeperTradedPicks(leagueId, { fresh: true }),
      getSleeperLeagueDrafts(leagueId, { fresh: true }),
    ]);

    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }
    const myRosterId = Number(rosterId);
    if (!rosters.some((r) => r.roster_id === myRosterId)) {
      return NextResponse.json({ error: "Couldn't find that team in this league." }, { status: 404 });
    }

    // Sleeper's own draft object for this exact season, if one
    // exists, is more trustworthy than anything this app could
    // project from standings — a commissioner or Sleeper itself may
    // have already locked in a real order (draft_order maps user_id
    // -> slot), independent of whether the preceding season has
    // concluded. Only when nothing authoritative exists does this
    // fall back to the standings-based projection below, which is
    // where the season-completion gate actually matters.
    const matchingDraft = drafts.find((d) => d.season === season);
    let slotToRosterIdOverride: Map<number, number> | undefined;
    if (matchingDraft?.draft_order && Object.keys(matchingDraft.draft_order).length > 0) {
      const map = new Map<number, number>();
      for (const [userId, slot] of Object.entries(matchingDraft.draft_order)) {
        const roster = rosters.find((r) => r.owner_id === userId);
        if (roster) map.set(slot, roster.roster_id);
      }
      if (map.size > 0) slotToRosterIdOverride = map;
    }
    const usedAuthoritativeOrder = slotToRosterIdOverride !== undefined;
    console.error(
      `[draft-order] league ${leagueId}, season ${season}: ${usedAuthoritativeOrder ? `using Sleeper's own draft_order (${slotToRosterIdOverride!.size} slots)` : "no authoritative draft_order found, falling back to standings projection"}`
    );

    // A rookie class's draft slot order is determined by the FINAL
    // standings of the season immediately before it — the "2027"
    // class's order comes from the 2026 season's final record, which
    // doesn't exist until that season is actually over. Computing a
    // slot from an in-progress or not-yet-started season's 0-0 (or
    // partial) standings isn't a rough estimate, it's fabricated —
    // confirmed in production as the exact cause of every pick
    // showing as slot 1 (all records tied, so the "worst record"
    // sort just fell back to array order). This app has no way to
    // know a season's true final order more than one year out
    // either, so anything other than an exact one-year gap is also
    // treated as undetermined. None of this applies when Sleeper's
    // own draft_order is already available above — that's real
    // regardless of standings.
    if (!usedAuthoritativeOrder) {
      const seasonGapIsOneYear = Number(season) === Number(league.season) + 1;
      const seasonIsFinal = league.status === "complete";
      if (!seasonGapIsOneYear || !seasonIsFinal) {
        return NextResponse.json({
          notDetermined: true,
          leagueSeason: league.season,
          leagueStatus: league.status ?? "unknown",
        });
      }
    }

    const order = computeRealDraftOrder(rosters, tradedPicks, season, rounds, slotToRosterIdOverride);

    const teamNameByRosterId = new Map<number, string>();
    for (const r of rosters) {
      const owner = r.owner_id ? leagueUsers.find((u) => u.user_id === r.owner_id) : undefined;
      teamNameByRosterId.set(r.roster_id, owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`);
    }

    return NextResponse.json({
      teams: rosters.length,
      rounds,
      source: usedAuthoritativeOrder ? "sleeper" : "projected",
      picks: order.map((p) => ({
        overall: p.overall,
        round: p.round,
        slot: p.slot,
        teamName: teamNameByRosterId.get(p.ownerRosterId) ?? "Unknown Team",
        isUser: p.ownerRosterId === myRosterId,
      })),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// Saves (or, for an already-synced team, just bumps the timestamp on)
// which Sleeper team is linked to this account — this is what makes
// the sync persist across visits instead of resetting, and is also
// how Mock Draft knows which team's needs to suggest against.
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to use Team Sync." }, { status: 401 });
  }

  let body: { leagueId?: unknown; rosterId?: unknown; leagueName?: unknown; teamName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const leagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  const rosterId = typeof body.rosterId === "number" ? body.rosterId : NaN;
  const leagueName = typeof body.leagueName === "string" ? body.leagueName : "";
  const teamName = typeof body.teamName === "string" ? body.teamName : "";
  if (!leagueId || !Number.isFinite(rosterId) || !leagueName || !teamName) {
    return NextResponse.json({ error: "Missing team data." }, { status: 400 });
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO synced_sleeper_teams (id, user_id, league_id, roster_id, league_name, team_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id, league_id, roster_id)
     DO UPDATE SET league_name = EXCLUDED.league_name, team_name = EXCLUDED.team_name, updated_at = now()
     RETURNING id`,
    [crypto.randomUUID(), user.id, leagueId, rosterId, leagueName, teamName]
  );

  return NextResponse.json({ id: rows[0]?.id });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to use Team Sync." }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  await query(`DELETE FROM synced_sleeper_teams WHERE id = $1 AND user_id = $2`, [id, user.id]);
  return NextResponse.json({ ok: true });
}
