import { describe, it, expect } from "vitest";
import { buildRanksWithinCollection, getDDScore, getDDTier, getRankForFormat } from "@/lib/ddScore";
import type { Prospect } from "@/types/prospect";

function prospect(overrides: Partial<Prospect> & { id: string }): Prospect {
  return {
    name: overrides.id,
    position: "WR",
    ...overrides,
  } as Prospect;
}

describe("buildRanksWithinCollection", () => {
  it("ranks drafted players by format score, then undrafted players after them by Pre-Draft Score", () => {
    const players = [
      prospect({ id: "low-drafted", hasDraftData: true, ddScore1QB: 80 }),
      prospect({ id: "high-drafted", hasDraftData: true, ddScore1QB: 95 }),
      prospect({ id: "undrafted", hasDraftData: false, preDraftScore: 70 }),
    ];
    const ranks = buildRanksWithinCollection(players, "1QB");
    expect(ranks.get("high-drafted")).toBe(1);
    expect(ranks.get("low-drafted")).toBe(2);
    expect(ranks.get("undrafted")).toBe(3);
  });

  it("treats hasDraftData === undefined the same as false (undrafted) — regression test for the veteran-player mismatch bug", () => {
    // This is exactly the bug found in production: a historical
    // player whose name never matched a live tab left hasDraftData
    // as undefined (never explicitly set), and code that checked
    // `=== true` vs `!== true` disagreed about whether that counted
    // as drafted. buildRanksWithinCollection uses `!== true` for the
    // undrafted bucket, so undefined must land there too.
    const players = [
      prospect({ id: "real-veteran", hasDraftData: undefined, ddScore1QB: 90, preDraftScore: 20 }),
      prospect({ id: "real-devy", hasDraftData: false, preDraftScore: 60 }),
    ];
    const ranks = buildRanksWithinCollection(players, "1QB");
    // The veteran has no real ddScore1QB counted (excluded from the
    // "drafted" bucket since hasDraftData isn't === true), so despite
    // having a ddScore1QB value set, they're ranked among undrafted
    // players by preDraftScore (20), landing behind the devy prospect (60).
    expect(ranks.get("real-devy")).toBe(1);
    expect(ranks.get("real-veteran")).toBe(2);
  });

  it("assigns sequential ranks starting at 1 with no gaps", () => {
    const players = [
      prospect({ id: "a", hasDraftData: true, ddScoreSuperflex: 50 }),
      prospect({ id: "b", hasDraftData: true, ddScoreSuperflex: 70 }),
      prospect({ id: "c", hasDraftData: true, ddScoreSuperflex: 60 }),
    ];
    const ranks = buildRanksWithinCollection(players, "SUPERFLEX");
    expect([...ranks.values()].sort((x, y) => x - y)).toEqual([1, 2, 3]);
  });
});

describe("getDDScore / getDDTier / getRankForFormat", () => {
  const p = prospect({
    id: "x",
    ddScore1QB: 91,
    ddScoreSuperflex: 88,
    ddScore1QBTEP: 92,
    ddScoreSuperflexTEP: 89,
    tier1QB: "Elite",
    tierSuperflex: "Starter",
    ddRank1QB: 5,
    ddRankSuperflex: 12,
  });

  it("reads the correct score field per format", () => {
    expect(getDDScore(p, "1QB")).toBe(91);
    expect(getDDScore(p, "SUPERFLEX")).toBe(88);
    expect(getDDScore(p, "1QB_TEP")).toBe(92);
    expect(getDDScore(p, "SUPERFLEX_TEP")).toBe(89);
  });

  it("reads the correct tier field per format", () => {
    expect(getDDTier(p, "1QB")).toBe("Elite");
    expect(getDDTier(p, "SUPERFLEX")).toBe("Starter");
  });

  it("reads the correct rank field per format", () => {
    expect(getRankForFormat(p, "1QB")).toBe(5);
    expect(getRankForFormat(p, "SUPERFLEX")).toBe(12);
  });
});
