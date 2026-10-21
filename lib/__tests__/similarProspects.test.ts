import { describe, it, expect } from "vitest";
import { findSimilarProspects } from "@/lib/similarProspects";
import type { Prospect } from "@/types/prospect";

function wr(
  id: string,
  subScores: { label: string; value?: number }[],
  ddScoreSuperflex?: number
): Prospect {
  return {
    id,
    name: id,
    position: "WR",
    subScores,
    ddScoreSuperflex,
    hasDraftData: true,
  } as Prospect;
}

// Every prospect here carries a Draft Capital sub-score so isResolved()
// treats them as drafted, which is the normal comparison regime.
const DC = { label: "Draft Capital", value: 50 };

describe("findSimilarProspects", () => {
  it("ignores candidates that share too few metrics", () => {
    const target = wr("target", [DC, { label: "Production", value: 90 }, { label: "Dominator", value: 90 }], 90);

    // Matches perfectly on the one metric it shares, and nothing else.
    const thin = wr("thin", [DC, { label: "Production", value: 90 }], 90);
    // Slightly off across the full profile, but genuinely comparable.
    const broad = wr("broad", [DC, { label: "Production", value: 85 }, { label: "Dominator", value: 86 }], 88);

    const result = findSimilarProspects(target, [thin, broad], {}, 3);
    expect(result.map((p) => p.id)).toEqual(["broad"]);
  });

  it("weights metrics by their model importance", () => {
    const target = wr("target", [DC, { label: "Production", value: 90 }, { label: "Dominator", value: 50 }], 80);

    // Matches on the heavily weighted metric, differs on the light one.
    const matchesImportant = wr("important", [DC, { label: "Production", value: 90 }, { label: "Dominator", value: 70 }], 80);
    // The reverse.
    const matchesTrivial = wr("trivial", [DC, { label: "Production", value: 70 }, { label: "Dominator", value: 50 }], 80);

    const weights = { Production: 30, Dominator: 1, "Draft Capital": 1 };
    const result = findSimilarProspects(target, [matchesTrivial, matchesImportant], weights, 1);
    expect(result[0]?.id).toBe("important");
  });

  it("keeps distances comparable when candidates share different metric counts", () => {
    const target = wr(
      "target",
      [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }, { label: "Size", value: 80 }],
      80
    );

    // Identical on every metric it has, but only shares three.
    const fewer = wr("fewer", [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }], 80);
    // Identical on all four.
    const full = wr(
      "full",
      [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }, { label: "Size", value: 80 }],
      80
    );

    const result = findSimilarProspects(target, [fewer, full], {}, 2);
    // Both are legitimate matches; the fuller profile should not be
    // ranked worse simply for having more dimensions to differ on.
    expect(result[0]?.id).toBe("full");
  });

  it("penalises a large overall-grade gap even when metrics line up", () => {
    const target = wr("target", [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }], 95);

    const sameGrade = wr("same", [DC, { label: "Production", value: 78 }, { label: "Dominator", value: 78 }], 94);
    const farGrade = wr("far", [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }], 40);

    const result = findSimilarProspects(target, [farGrade, sameGrade], {}, 1);
    expect(result[0]?.id).toBe("same");
  });

  it("returns nothing rather than filler when no candidate is comparable", () => {
    const target = wr("target", [DC, { label: "Production", value: 80 }, { label: "Dominator", value: 80 }], 80);
    const unrelated = wr("unrelated", [DC, { label: "Speed", value: 80 }], 80);

    expect(findSimilarProspects(target, [unrelated], {}, 3)).toEqual([]);
  });
});
