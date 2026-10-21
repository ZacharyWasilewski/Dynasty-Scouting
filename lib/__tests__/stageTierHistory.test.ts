import { describe, expect, it } from "vitest";
import { computeHitRateByPositionAndTier, type LeagueFormatSelection } from "@/lib/analytics";
import { playerScoreStage } from "@/lib/scoreStage";
import type { Prospect } from "@/types/prospect";
const p = (id: string, fields: Partial<Prospect>): Prospect => ({ id, name: id, position: "WR", hasDraftData: true, ...fields });
const format: LeagueFormatSelection = { qbFormat: "SF", tepFormat: "STANDARD" };
const history = [
  p("a", { hitMiss: "HIT", ddScoreSuperflex:98, tierSuperflex:"Generational", preDraftScore:96, rawScore:80 }),
  p("b", { hitMiss: "MISS", ddScoreSuperflex:97, tierSuperflex:"Generational", preDraftScore:80, rawScore:96 }),
  p("c", { hitMiss: "MISS", ddScoreSuperflex:80, tierSuperflex:"Starter", preDraftScore:97, rawScore:80 }),
  p("d", { hitMiss: "MISS", ddScoreSuperflex:80, tierSuperflex:"Starter", preDraftScore:98, rawScore:70 }),
  p("push", { finish: "RP", rawScore:99, preDraftScore:99 }),
  p("unresolved", { rawScore:99, preDraftScore:99, hasDraftData:false }),
  p("missing", { hitMiss:"HIT", ddScoreSuperflex:80, tierSuperflex:"Starter" }),
  p("other-position", { position:"RB", hitMiss:"HIT", rawScore:99, preDraftScore:99 }),
];
describe("stage-specific historical tier cohorts", () => {
  it("produces independent DD, Pre-Draft and Raw rates at the same displayed tier", () => {
    const row = (stage: "dd" | "preDraft" | "raw") => computeHitRateByPositionAndTier(history,"WR",format,["Generational"],stage)[0]!;
    expect(row("dd")).toMatchObject({ count:2, hitRate:50 });
    expect(row("preDraft").count).toBe(3);
    expect(row("preDraft").hitRate).toBeCloseTo(100/3);
    expect(row("raw")).toMatchObject({ count:1, hitRate:0 });
  });
  it("does not borrow DD scores or count unresolved outcomes when early scores are missing", () => {
    const data=[p("no-early",{hitMiss:"HIT",ddScoreSuperflex:100,tierSuperflex:"Generational"})];
    expect(computeHitRateByPositionAndTier(data,"WR",format,["Generational"],"preDraft")[0]).toMatchObject({hitRate:null,count:0});
    expect(computeHitRateByPositionAndTier(data,"WR",format,["Generational"],"raw")[0]).toMatchObject({hitRate:null,count:0});
  });
  it.each(["raw", "preDraft"] as const)("applies QB and TE adjustments to historical %s scores in all four formats", stage => {
    const qb=[p("qb",{position:"QB",hitMiss:"HIT",rawScore:90,preDraftScore:90})];
    const te=[p("te",{position:"TE",hitMiss:"MISS",rawScore:97,preDraftScore:97})];
    for (const qbFormat of ["1QB","SF"] as const) for (const tepFormat of ["STANDARD","TEP"] as const) {
      const sel={qbFormat,tepFormat};
      const qbTier=qbFormat==="SF" ? "Generational":"Starter";
      const teTier=tepFormat==="TEP" ? "Generational":"Elite";
      expect(computeHitRateByPositionAndTier(qb,"QB",sel,[qbTier],stage)[0]).toMatchObject({hitRate:100,count:1});
      expect(computeHitRateByPositionAndTier(te,"TE",sel,[teTier],stage)[0]).toMatchObject({hitRate:0,count:1});
    }
  });
  it("selects the profile's actual stage and preserves Raw-only profile / mock-room distinction", () => {
    expect(playerScoreStage(p("dd",{rawScore:99,preDraftScore:99}))).toBe("dd");
    expect(playerScoreStage(p("pre",{hasDraftData:false,draftClass:"2027",preDraftScore:96}))).toBe("preDraft");
    const future=p("raw",{hasDraftData:false,draftClass:"2028",rawScore:90,preDraftScore:95});
    expect(playerScoreStage(future)).toBe("raw");
    expect(playerScoreStage(future,"mock")).toBe("preDraft");
  });
});
