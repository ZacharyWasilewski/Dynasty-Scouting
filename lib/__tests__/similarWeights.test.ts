import { describe, expect, it } from "vitest";
import { findSimilarProspects } from "../similarProspects";
import type { Prospect } from "@/types/prospect";

const mk = (id: string, cls: string, subs: [string, number][], extra: Partial<Prospect> = {}): Prospect =>
  ({ id, name: id, position: "WR", draftClass: cls, preDraftScore: 80, rawScore: 80,
     subScores: subs.map(([label, value]) => ({ label, value })), ...extra }) as unknown as Prospect;

describe("findSimilarProspects weighting", () => {
  const target = mk("t", "2027", [["Size", 50], ["Speed", 50], ["Production", 50], ["Mock", 50]]);

  it("prefers the candidate that is close on the heavily weighted metric", () => {
    const closeOnHeavy = mk("heavy", "2020", [["Size", 90], ["Speed", 90], ["Production", 51], ["Mock", 50]]);
    const closeOnLight = mk("light", "2021", [["Size", 51], ["Speed", 51], ["Production", 90], ["Mock", 50]]);
    const weights = { Size: 1, Speed: 1, Production: 18, Mock: 18 };
    const out = findSimilarProspects(target, [closeOnLight, closeOnHeavy], weights, 2);
    expect(out[0]?.id).toBe("heavy");
  });

  it("uses a drafted player's Mock percentile against a pre-draft prospect", () => {
    const drafted = mk("d", "2019", [["Size", 50], ["Speed", 50], ["Production", 50], ["Draft Capital", 10]], { hasDraftData: true, mockPercentile: 50 });
    const drafted2 = mk("d2", "2018", [["Size", 50], ["Speed", 50], ["Production", 50], ["Draft Capital", 10]], { hasDraftData: true, mockPercentile: 5 });
    const pre = { ...target, hasDraftData: false } as Prospect;
    const out = findSimilarProspects(pre, [drafted2, drafted], { Mock: 18, Size: 1, Speed: 1, Production: 1 }, 2);
    expect(out[0]?.id).toBe("d"); // same Mock percentile, so closer than d2
  });

  it("does not let a metric with no sheet weight vanish next to heavy ones", () => {
    // Size has no weight, so it takes the average of the others (12). a is exact
    // on Size and 10 off elsewhere; b is exact elsewhere and 20 off on Size. At a
    // flat weight of 1 Size would barely register and b would wrongly win.
    const a = mk("a", "2020", [["Size", 50], ["Speed", 60], ["Production", 60], ["Mock", 60]]);
    const b = mk("b", "2021", [["Size", 70], ["Speed", 50], ["Production", 50], ["Mock", 50]]);
    const out = findSimilarProspects(target, [b, a], { Speed: 12, Production: 12, Mock: 12 }, 2);
    expect(out[0]?.id).toBe("a");
  });
});
