import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prospect } from "@/types/prospect";
import type { PositionNeed } from "@/lib/teamNeeds";

const getScoreDeltas = vi.fn();
vi.mock("@/lib/trending", () => ({
  getScoreDeltas: (...args: unknown[]) => getScoreDeltas(...args),
}));

const { getMoversAtNeeds } = await import("@/lib/needsDigest");

function prospect(overrides: Partial<Prospect> & { id: string }): Prospect {
  return { name: overrides.id, position: "WR", ...overrides } as Prospect;
}

function need(overrides: Partial<PositionNeed> & { position: PositionNeed["position"] }): PositionNeed {
  return { rosteredCount: 0, totalValue: 0, leagueAvgValue: 0, percentile: 50, needScore: 0, ...overrides };
}

beforeEach(() => {
  getScoreDeltas.mockReset();
});

describe("getMoversAtNeeds", () => {
  it("returns nothing at all if the team has no real needs — never even bothers fetching deltas", async () => {
    const needs = [need({ position: "QB", needScore: 0 }), need({ position: "RB", needScore: 0 })];
    const result = await getMoversAtNeeds([], needs);
    expect(result).toEqual([]);
    expect(getScoreDeltas).not.toHaveBeenCalled();
  });

  it("only includes movers at positions the team actually needs, not every mover", async () => {
    const needs = [need({ position: "WR", needScore: 20 })]; // only WR is a need
    getScoreDeltas.mockResolvedValue(new Map([
      ["a", 5], // WR — needed
      ["b", -3], // RB — not needed
    ]));
    const prospects = [
      prospect({ id: "a", position: "WR" }),
      prospect({ id: "b", position: "RB" }),
    ];
    const result = await getMoversAtNeeds(prospects, needs);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a");
  });

  it("sorts by the magnitude of movement, not direction — a big faller matters as much as a big riser", async () => {
    const needs = [need({ position: "WR", needScore: 20 })];
    getScoreDeltas.mockResolvedValue(new Map([
      ["a", 1],
      ["b", -10],
      ["c", 3],
    ]));
    const prospects = ["a", "b", "c"].map((id) => prospect({ id, position: "WR" }));
    const result = await getMoversAtNeeds(prospects, needs);
    expect(result.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("respects the limit parameter", async () => {
    const needs = [need({ position: "WR", needScore: 20 })];
    getScoreDeltas.mockResolvedValue(new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]));
    const prospects = ["a", "b", "c", "d"].map((id) => prospect({ id, position: "WR" }));
    const result = await getMoversAtNeeds(prospects, needs, 2);
    expect(result).toHaveLength(2);
  });

  it("returns nothing when there are needs but genuinely no score movement at all", async () => {
    const needs = [need({ position: "WR", needScore: 20 })];
    getScoreDeltas.mockResolvedValue(new Map());
    const result = await getMoversAtNeeds([prospect({ id: "a", position: "WR" })], needs);
    expect(result).toEqual([]);
  });

  it("skips a delta entry whose prospect can't be found (defensive — shouldn't happen, but shouldn't crash either)", async () => {
    const needs = [need({ position: "WR", needScore: 20 })];
    getScoreDeltas.mockResolvedValue(new Map([["ghost", 5]]));
    const result = await getMoversAtNeeds([], needs);
    expect(result).toEqual([]);
  });
});
