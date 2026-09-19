import { describe, it, expect } from "vitest";
import {
  computeOverallGrade,
  computeDraftSlots,
  tierForSlot,
  computeOwnedPicks,
  getPickValue,
  valueOwnedPicks,
  computeRealDraftOrder,
  isTepLeague,
} from "@/lib/teamNeeds";
import type { SleeperRoster, SleeperTradedPick } from "@/lib/sleeper";
import type { PickValue } from "@/lib/fantasyCalcData";

describe("computeOverallGrade", () => {
  it("puts the 50th percentile (a perfectly average team) in the C range, not near-failing", () => {
    // 11 teams total, including this one: 5 worse, 5 better, this
    // one dead in the middle. leagueTotalValues includes the caller's
    // own entry — see how this is actually called in
    // app/api/sleeper/route.ts (allRosters.map(...) covers every
    // roster in the league, including the user's).
    const league = [100, 100, 100, 100, 100, 150, 200, 200, 200, 200, 200];
    expect(computeOverallGrade(150, league).percentile).toBe(50);
    expect(computeOverallGrade(150, league).grade).toBe("C+");
  });

  it("grades the strongest team in the league as A+", () => {
    const league = [100, 200, 300, 400, 500];
    expect(computeOverallGrade(500, league).grade).toBe("A+");
    expect(computeOverallGrade(500, league).percentile).toBe(100);
  });

  it("grades the weakest team in the league as F", () => {
    const league = [100, 200, 300, 400, 500];
    expect(computeOverallGrade(100, league).grade).toBe("F");
    expect(computeOverallGrade(100, league).percentile).toBe(0);
  });

  it("falls back to 100th percentile when there's no real league to compare against (0 or 1 team total)", () => {
    expect(computeOverallGrade(100, []).percentile).toBe(100);
    expect(computeOverallGrade(100, [100]).percentile).toBe(100);
  });
});

describe("computeDraftSlots", () => {
  function roster(id: number, wins: number, fpts = 0): SleeperRoster {
    return { roster_id: id, owner_id: String(id), players: null, settings: { wins, fpts } };
  }

  it("gives the worst record the first pick — standard dynasty rookie-draft convention", () => {
    const slots = computeDraftSlots([roster(1, 10), roster(2, 2), roster(3, 6)]);
    expect(slots.get(2)).toBe(1); // fewest wins, picks first
    expect(slots.get(3)).toBe(2);
    expect(slots.get(1)).toBe(3); // most wins, picks last
  });

  it("tiebreaks equal records by fewer points-for picking earlier", () => {
    const slots = computeDraftSlots([roster(1, 5, 900), roster(2, 5, 700)]);
    expect(slots.get(2)).toBe(1);
    expect(slots.get(1)).toBe(2);
  });

  it("treats a roster with no settings object as 0 wins / 0 points rather than throwing", () => {
    const noSettings: SleeperRoster = { roster_id: 9, owner_id: "9", players: null };
    const slots = computeDraftSlots([roster(1, 3), noSettings]);
    expect(slots.get(9)).toBe(1);
  });
});

describe("tierForSlot", () => {
  it("buckets a 12-team league into exact thirds — the exact spec given for this feature", () => {
    expect(tierForSlot(1, 12)).toBe("EARLY");
    expect(tierForSlot(4, 12)).toBe("EARLY");
    expect(tierForSlot(5, 12)).toBe("MID");
    expect(tierForSlot(8, 12)).toBe("MID");
    expect(tierForSlot(9, 12)).toBe("LATE");
    expect(tierForSlot(12, 12)).toBe("LATE");
  });

  it("scales proportionally for a non-12-team league instead of using fixed slot numbers", () => {
    // 10-team league: thirds of ceil(10/3)=4 → 1-4 Early, 5-8 Mid, 9-10 Late.
    expect(tierForSlot(4, 10)).toBe("EARLY");
    expect(tierForSlot(5, 10)).toBe("MID");
    expect(tierForSlot(9, 10)).toBe("LATE");
  });
});

describe("computeOwnedPicks", () => {
  const noTrades: SleeperTradedPick[] = [];

  it("gives every roster its own picks by default when nothing has been traded", () => {
    const owned = computeOwnedPicks(5, noTrades);
    // 2 tracked seasons × 4 rounds = 8 picks owned by default.
    expect(owned).toHaveLength(8);
    expect(owned.every((p) => p.originalRosterId === 5)).toBe(true);
  });

  it("removes a pick the user traded away", () => {
    const trades: SleeperTradedPick[] = [{ season: "2027", round: 1, roster_id: 5, owner_id: 9 }];
    const owned = computeOwnedPicks(5, trades);
    expect(owned.find((p) => p.season === "2027" && p.round === 1)).toBeUndefined();
    expect(owned).toHaveLength(7);
  });

  it("adds a pick the user acquired from someone else, tagged with the ORIGINAL owner (whose record determines the slot)", () => {
    const trades: SleeperTradedPick[] = [{ season: "2027", round: 1, roster_id: 9, owner_id: 5 }];
    const owned = computeOwnedPicks(5, trades);
    const acquired = owned.find((p) => p.season === "2027" && p.round === 1 && p.originalRosterId === 9);
    expect(acquired).toBeDefined();
    // Still has all 8 of the user's own default picks too.
    expect(owned).toHaveLength(9);
  });

  it("handles a pick traded away and a different pick acquired in the same season/round without cross-contamination", () => {
    const trades: SleeperTradedPick[] = [
      { season: "2027", round: 2, roster_id: 5, owner_id: 9 }, // traded away
      { season: "2027", round: 2, roster_id: 3, owner_id: 5 }, // acquired
    ];
    const owned = computeOwnedPicks(5, trades);
    expect(owned.find((p) => p.season === "2027" && p.round === 2 && p.originalRosterId === 5)).toBeUndefined();
    expect(owned.find((p) => p.season === "2027" && p.round === 2 && p.originalRosterId === 3)).toBeDefined();
  });

  it("ignores trades for seasons outside the tracked window", () => {
    const trades: SleeperTradedPick[] = [{ season: "2030", round: 1, roster_id: 9, owner_id: 5 }];
    const owned = computeOwnedPicks(5, trades);
    expect(owned).toHaveLength(8); // unaffected by the untracked-season trade
  });
});

describe("getPickValue", () => {
  const values: PickValue[] = [
    { season: "2027", round: 1, tier: "EARLY", value: 5000 },
    { season: "2027", round: 1, tier: "LATE", value: 2000 },
    { season: "2027", round: 2, tier: "ANY", value: 800 },
  ];

  it("uses the exact tier match when one exists", () => {
    expect(getPickValue(values, "2027", 1, "EARLY")).toBe(5000);
  });

  it("falls back to the blended ANY value when no tier-specific entry exists for that round", () => {
    expect(getPickValue(values, "2027", 2, "MID")).toBe(800);
  });

  it("returns 0 (not undefined, not a throw) when nothing matches at all", () => {
    expect(getPickValue(values, "2029", 4, "LATE")).toBe(0);
  });
});

describe("valueOwnedPicks", () => {
  it("sums value across every owned pick using each pick's own original-owner slot", () => {
    const owned = [
      { season: "2027", round: 1, originalRosterId: 1 }, // slot 1 → EARLY
      { season: "2027", round: 1, originalRosterId: 3 }, // slot 3 → LATE (3-team league)
    ];
    const draftSlots = new Map([[1, 1], [2, 2], [3, 3]]);
    const values: PickValue[] = [
      { season: "2027", round: 1, tier: "EARLY", value: 5000 },
      { season: "2027", round: 1, tier: "LATE", value: 1000 },
    ];
    expect(valueOwnedPicks(owned, draftSlots, values, 3)).toBe(6000);
  });

  it("treats a pick whose original owner has no known draft slot as tier ANY rather than crashing", () => {
    const owned = [{ season: "2027", round: 1, originalRosterId: 99 }];
    const draftSlots = new Map<number, number>();
    const values: PickValue[] = [{ season: "2027", round: 1, tier: "ANY", value: 3000 }];
    expect(valueOwnedPicks(owned, draftSlots, values, 12)).toBe(3000);
  });
});

describe("computeRealDraftOrder", () => {
  function roster(id: number, wins: number): SleeperRoster {
    return { roster_id: id, owner_id: String(id), players: null, settings: { wins } };
  }

  it("produces a full straight-order draft (not snake) matching each team's standings-based slot when nothing's been traded", () => {
    // 3 teams, wins 10/2/6 → draft order (worst first): roster 2 (slot 1), roster 3 (slot 2), roster 1 (slot 3).
    const rosters = [roster(1, 10), roster(2, 2), roster(3, 6)];
    const order = computeRealDraftOrder(rosters, [], "2027", 2);

    expect(order).toHaveLength(6); // 2 rounds × 3 teams
    // Round 1: overall 1,2,3 → rosters 2,3,1 in slot order.
    expect(order.filter((p) => p.round === 1).map((p) => p.ownerRosterId)).toEqual([2, 3, 1]);
    // Round 2 (straight order, NOT reversed): same slot pattern again.
    expect(order.filter((p) => p.round === 2).map((p) => p.ownerRosterId)).toEqual([2, 3, 1]);
    // Overall pick numbers are sequential across rounds.
    expect(order.map((p) => p.overall)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("reflects a real trade — the traded pick's owner changes, everything else stays on the default standings-based owner", () => {
    const rosters = [roster(1, 10), roster(2, 2), roster(3, 6)];
    // Roster 2 (owns round-1 slot 1 by default) trades that pick to roster 1.
    const trades: SleeperTradedPick[] = [{ season: "2027", round: 1, roster_id: 2, owner_id: 1 }];
    const order = computeRealDraftOrder(rosters, trades, "2027", 1);

    const round1Slot1 = order.find((p) => p.round === 1 && p.slot === 1);
    expect(round1Slot1?.ownerRosterId).toBe(1); // traded away from roster 2, now roster 1
    const round1Slot2 = order.find((p) => p.round === 1 && p.slot === 2);
    expect(round1Slot2?.ownerRosterId).toBe(3); // unaffected
  });

  it("ignores a trade for a different season entirely", () => {
    const rosters = [roster(1, 10), roster(2, 2)];
    const trades: SleeperTradedPick[] = [{ season: "2028", round: 1, roster_id: 2, owner_id: 1 }];
    const order = computeRealDraftOrder(rosters, trades, "2027", 1);
    const round1Slot1 = order.find((p) => p.round === 1 && p.slot === 1);
    expect(round1Slot1?.ownerRosterId).toBe(2); // 2027 pick untouched by a 2028 trade
  });
});

describe("isTepLeague", () => {
  it("is true when base reception points alone exceed 1.0", () => {
    expect(isTepLeague({ rec: 1.5 })).toBe(true);
  });

  it("is true when a TE-specific bonus pushes the total over 1.0, even with a lower base", () => {
    expect(isTepLeague({ rec: 1, bonus_rec_te: 0.5 })).toBe(true);
  });

  it("is false at standard 1.0 PPR with no TE bonus — exactly 1.0 does not count as premium", () => {
    expect(isTepLeague({ rec: 1 })).toBe(false);
  });

  it("is false for a non-PPR or low-PPR league with no TE bonus", () => {
    expect(isTepLeague({ rec: 0.5 })).toBe(false);
    expect(isTepLeague({})).toBe(false);
  });

  it("handles a missing scoring_settings object entirely without throwing", () => {
    expect(isTepLeague(undefined)).toBe(false);
  });
});

describe("computeRealDraftOrder with an authoritative slot override", () => {
  function roster(id: number, wins: number): SleeperRoster {
    return { roster_id: id, owner_id: String(id), players: null, settings: { wins } };
  }

  it("uses the override mapping instead of standings when one is provided", () => {
    // Standings would normally put roster 2 (fewest wins) at slot 1 —
    // but an authoritative override says roster 3 owns slot 1 instead
    // (e.g. Sleeper's own draft_order, set independently of records).
    const rosters = [roster(1, 10), roster(2, 2), roster(3, 6)];
    const override = new Map([[1, 3], [2, 1], [3, 2]]);

    const order = computeRealDraftOrder(rosters, [], "2027", 1, override);

    expect(order.find((p) => p.slot === 1)?.ownerRosterId).toBe(3);
    expect(order.find((p) => p.slot === 2)?.ownerRosterId).toBe(1);
    expect(order.find((p) => p.slot === 3)?.ownerRosterId).toBe(2);
  });

  it("still correctly applies trades on top of an override mapping", () => {
    const rosters = [roster(1, 10), roster(2, 2), roster(3, 6)];
    const override = new Map([[1, 3], [2, 1], [3, 2]]);
    // Roster 3 (override's slot-1 owner) trades that pick to roster 2.
    const trades: SleeperTradedPick[] = [{ season: "2027", round: 1, roster_id: 3, owner_id: 2 }];

    const order = computeRealDraftOrder(rosters, trades, "2027", 1, override);

    expect(order.find((p) => p.slot === 1)?.ownerRosterId).toBe(2);
  });
});
