import { describe, it, expect } from "vitest";
import { computeCombinedHitRate } from "@/lib/analytics";
import type { Prospect } from "@/types/prospect";

function prospect(overrides: Partial<Prospect> & { id: string }): Prospect {
  return {
    name: overrides.id,
    position: "WR",
    ...overrides,
  } as Prospect;
}

describe("computeCombinedHitRate", () => {
  it("combines hit/miss outcomes across multiple tiers into one rate", () => {
    const prospects = [
      prospect({ id: "a", tierSuperflex: "Generational", hitMiss: "HIT" }),
      prospect({ id: "b", tierSuperflex: "Generational", hitMiss: "MISS" }),
      prospect({ id: "c", tierSuperflex: "Elite", hitMiss: "HIT" }),
      prospect({ id: "d", tierSuperflex: "Elite", hitMiss: "HIT" }),
    ];
    const result = computeCombinedHitRate(prospects, ["Generational", "Elite"]);
    expect(result?.sampleSize).toBe(4);
    expect(result?.hitRate).toBe(75); // 3 of 4
  });

  it("excludes prospects with no resolved hit/miss outcome yet", () => {
    const prospects = [
      prospect({ id: "a", tierSuperflex: "Elite", hitMiss: "HIT" }),
      prospect({ id: "b", tierSuperflex: "Elite", hitMiss: undefined }), // still active/unresolved
    ];
    const result = computeCombinedHitRate(prospects, ["Elite"]);
    expect(result?.sampleSize).toBe(1);
    expect(result?.hitRate).toBe(100);
  });

  it("ignores prospects outside the requested tiers entirely", () => {
    const prospects = [
      prospect({ id: "a", tierSuperflex: "Elite", hitMiss: "HIT" }),
      prospect({ id: "b", tierSuperflex: "Bench", hitMiss: "MISS" }),
    ];
    const result = computeCombinedHitRate(prospects, ["Elite"]);
    expect(result?.sampleSize).toBe(1);
    expect(result?.hitRate).toBe(100);
  });

  it("returns null (not NaN or a throw) when there's no resolved data at all", () => {
    const prospects = [prospect({ id: "a", tierSuperflex: "Elite", hitMiss: undefined })];
    expect(computeCombinedHitRate(prospects, ["Elite"])).toBeNull();
  });
});
