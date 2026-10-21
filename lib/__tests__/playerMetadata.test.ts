import { describe, expect, it } from "vitest";
import { playerMetadata, playerShareDetails } from "@/lib/playerMetadata";
import type { Prospect } from "@/types/prospect";
const prospect: Prospect = { id: "sample-player-2027", name: "Sample Player", position: "WR", school: "OSU", draftClass: "2027", hasDraftData: false, preDraftScore: 100, rawScore: 82 };
describe("player social metadata", () => {
  it("replaces inherited home metadata with the actual player and selected format", () => {
    const meta = playerMetadata(prospect, "sf");
    expect(meta.title).toBe("Sample Player — Dynasty Database");
    expect(meta.description).toContain("Pre-Draft Score: 100.0");
    expect(meta.openGraph).toMatchObject({ url: "https://dynastydatabase.com/players/sample-player-2027?format=sf", title: meta.title });
    expect(meta.twitter).toMatchObject({ title: meta.title, description: meta.description });
    expect(meta.alternates?.canonical).toBe("https://dynastydatabase.com/players/sample-player-2027");
  });
  it("shows Raw scores for early devy prospects, without inventing a DD grade", () => {
    const details = playerShareDetails({...prospect, draftClass: "2028"});
    expect(details.stageLabel).toBe("Raw Score"); expect(details.score).toBe("82.0");
  });
  it("uses the drafted player's format-specific DD score", () => {
    const details = playerShareDetails({...prospect, hasDraftData:true, ddScoreSuperflex:93.1}, "sf");
    expect(details.stageLabel).toBe("DD Score"); expect(details.score).toBe("93.1");
  });
  it("keeps image format and text format aligned and defaults invalid input safely", () => {
    const details = playerShareDetails(prospect,"1qb-tep");
    expect(details.formatLabel).toBe("1QB · TE Premium"); expect(details.imageUrl).toContain("format=1qb-tep");
    expect(playerShareDetails(prospect,"invalid").formatLabel).toBe("Superflex · Standard");
  });
  it("does not turn missing or nonfinite data into a zero score", () => {
    const details = playerShareDetails({...prospect, preDraftScore:undefined,rawScore:undefined});
    expect(details.score).toBe("TBD"); expect(details.tier).toBeUndefined();
    expect(playerShareDetails({...prospect, rawScore:NaN, draftClass:"2028"}).score).toBe("TBD");
  });
});
