import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { writeFile } from "node:fs/promises";
const state=vi.hoisted(()=>({prospect: {id:"test",name:"Christopher Long-Name Jr.",position:"WR",draftClass:"2027",school:"OSU",preDraftScore:100} as object|null}));
vi.mock("@/lib/googleSheets",()=>({getProspectById:async()=>state.prospect}));
const {GET}=await import("@/app/players/[id]/share-image/route");
afterEach(()=>vi.unstubAllGlobals());
it("renders a real 1200×630 PNG with no external player image dependency",async()=>{
 vi.stubGlobal("React",React);
 const response=await GET(new Request("https://example.com/players/test/share-image?format=sf"),{params:{id:"test"}});
 expect(response.headers.get("content-type")).toContain("image/png");
 const png=Buffer.from(await response.arrayBuffer());expect(png.subarray(1,4).toString()).toBe("PNG");expect(png.readUInt32BE(16)).toBe(1200);expect(png.readUInt32BE(20)).toBe(630);
 await writeFile('/tmp/dynasty-player-share-preview.png',png);
});
it("returns 404 for an unknown player instead of a generic home card",async()=>{state.prospect=null;expect((await GET(new Request("https://example.com"),{params:{id:"unknown"}})).status).toBe(404);});
