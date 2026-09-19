import { describe, it, expect, vi, afterEach } from "vitest";
import { scoreAtStage, sharedScoreStage } from "@/lib/scoreStage";
import { computeCapitalVsModelHitRates } from "@/lib/analytics";
import { scopedRanks } from "@/lib/rankingScope";
import { validDraftCheckpoint } from "@/lib/draftCheckpoint";
import { saveBoard } from "@/lib/boardSave";
import type { Prospect } from "@/types/prospect";
const player = (id: string, fields: Partial<Prospect> = {}): Prospect => ({ id, name: id, position: "TE", ...fields });
afterEach(() => vi.unstubAllGlobals());
describe("sweep scoring and analytics regressions", () => {
 it("adjusts Raw, Pre-Draft and OIS consistently for a drafted TE", () => {
  const p = player("pitts", {hasDraftData:true,rawScore:98.3,preDraftScore:100,opportunityScore:100});
  expect(scoreAtStage(p,"raw","SUPERFLEX")).toBe(94.3);
  expect(scoreAtStage(p,"preDraft","SUPERFLEX")).toBe(96);
  expect(scoreAtStage(p,"opportunity","SUPERFLEX")).toBe(96);
  expect(scoreAtStage(p,"raw","SUPERFLEX_TEP")).toBe(97.3);
 });
 it("uses a symmetric common stage, including Raw-only prospects", () => {
  const a=player("a",{hasDraftData:true,preDraftScore:90,rawScore:80}); const b=player("b",{preDraftScore:70,rawScore:60});
  expect(sharedScoreStage(a,b)).toBe("preDraft"); expect(sharedScoreStage(b,a)).toBe("preDraft");
  expect(sharedScoreStage(a,player("raw",{rawScore:72}))).toBe("raw");
 });
 it("excludes unscored players from both equal-sized capital/model cohorts", () => {
  const rows=computeCapitalVsModelHitRates([player("a",{adp:1,ddScoreSuperflex:60,hitMiss:"MISS"}),player("b",{adp:40,ddScoreSuperflex:90,hitMiss:"HIT"}),player("c",{adp:2,hitMiss:"HIT"}),player("invalid",{adp:0,ddScoreSuperflex:99,hitMiss:"HIT"})]);
  expect(rows[0]?.tier).toBe("Picks 1–32"); expect(rows[0]?.capitalCount).toBe(1); expect(rows[0]?.modelCount).toBe(1);
  expect(rows[0]?.modelHitRate).toBe(100); expect(rows[0]?.capitalHitRate).toBe(0);
  expect(rows.every(r=>r.modelCount===r.capitalCount)).toBe(true);
 });
 it("keeps incoming-class ranks distinct from drafted rankings and missing scores", () => {
  const ranks=scopedRanks([player("old",{hasDraftData:true,ddScoreSuperflex:99}),player("raw",{draftClass:"2028",rawScore:90}),player("missing",{draftClass:"2028"}),player("raw2",{draftClass:"2028",rawScore:80})],"SUPERFLEX");
  expect(ranks.get("raw")).toBe(1);expect(ranks.get("raw2")).toBe(2);expect(ranks.has("missing")).toBe(false);
 });
});
const checkpoint = () => ({version:1,classYear:"2027",step:"draft",settings:{teams:12,qbFormat:"SUPERFLEX",teFormat:"STANDARD",slot:1,engine:"DD",pickTimer:15},prospects:[player("a"),player("b")],picks:[{overall:1,round:1,slot:1,playerId:"a",userPick:true}]});
describe("draft checkpoint recovery",()=>{
 it("accepts an in-progress session and every supported timer",()=>{for(const timer of ["UNTIMED",15,30,45,60,120,300]) {const c=checkpoint();expect(validDraftCheckpoint({...c,settings:{...c.settings,pickTimer:timer}})).toBe(true);}});
 it("rejects corrupt picks, duplicate players and premature results",()=>{const c=checkpoint();expect(validDraftCheckpoint({...c,picks:[...c.picks,...c.picks]})).toBe(false);expect(validDraftCheckpoint({...c,step:"results"})).toBe(false);expect(validDraftCheckpoint({...c,settings:{...c.settings,slot:13}})).toBe(false);});
 it("accepts a completed short pool without fabricating missing rounds",()=>{const c=checkpoint();expect(validDraftCheckpoint({...c,step:"results",picks:[...c.picks,{overall:2,round:1,slot:2,playerId:"b",userPick:false}]})).toBe(true);});
});
it("serializes board writes and retains pending recovery after a failed request",async()=>{
 let release: (()=>void) | undefined; const writes:string[]=[];const storage = new Map<string,string>([["key",JSON.stringify(["latest"])]]);
 vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k),removeItem:(k:string)=>storage.delete(k)});
 vi.stubGlobal("fetch",vi.fn(async (_url, init)=>{writes.push(init.body);if(writes.length===1)await new Promise<void>(r=>{release=r});return {ok:true};}));
 const a=saveBoard("key","2027",["first"]);const b=saveBoard("key","2027",["latest"]);await vi.waitFor(()=>expect(release).toBeDefined());expect(writes.length).toBe(1);release!();await Promise.all([a,b]);expect(writes.map(s=>JSON.parse(s).prospectIds[0])).toEqual(["first","latest"]);expect(storage.has("key")).toBe(false);
 storage.set("key",JSON.stringify(["retry"]));vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false}));await expect(saveBoard("key","2027",["retry"])).rejects.toThrow();expect(storage.has("key")).toBe(true);
});
