// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { SavedDraftBoard } from "@/components/mockDrafts/SavedDraftBoard";
import { ResultsScreen } from "@/components/mockDraft/MockDraftResultsScreen";
import type { Prospect } from "@/types/prospect";
const mocks=vi.hoisted(()=>({params:new URLSearchParams(),replace:vi.fn()}));
vi.mock("next/navigation",()=>({useSearchParams:()=>mocks.params,useRouter:()=>({replace:mocks.replace}),usePathname:()=>"/players"}));
vi.mock("next/link",()=>({default:({children,prefetch,...props}:any)=>React.createElement("a",props,children)}));
vi.mock("next/image",()=>({default:({unoptimized,priority,fill,...props}:any)=>React.createElement("img",props)}));
vi.mock("@/components/watchlist/WatchlistButton",()=>({WatchlistButton:()=>null}));
vi.mock("@/components/auth/AuthProvider",()=>({useAuth:()=>({user:{id:"user"},loading:false})}));
vi.mock("@/lib/globalFormat",()=>({getGlobalFormat:()=>"SUPERFLEX",reportFormatUsed:vi.fn()}));
vi.mock("@/lib/usePullToRefresh",()=>({usePullToRefresh:()=>({pullDistance:0,threshold:70,refreshing:false})}));
vi.mock("@/lib/track",()=>({track:vi.fn()}));
let host:HTMLDivElement;let root:Root;
beforeEach(()=>{
 vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"saved-id"})}));
 host=document.createElement("div");document.body.append(host);root=createRoot(host);localStorage.clear();sessionStorage.clear();
 mocks.params=new URLSearchParams();mocks.replace.mockReset().mockImplementation((url:string)=>{mocks.params=new URLSearchParams(url.split("?")[1]);});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const prospects:Prospect[]=[{id:"early",name:"Early Player",position:"WR",hasDraftData:false,preDraftScore:88,hitMiss:"MISS",draftClass:"2027"},{id:"dd",name:"Drafted Player",position:"WR",hasDraftData:true,ddScoreSuperflex:98,tierSuperflex:"Generational",hitMiss:"HIT"}];
it("starts mobile advanced filters collapsed, preserves their state on reopening and clears every filter",async()=>{
 mocks.params=new URLSearchParams("tier=Elite&stage=preDraft&outcome=MISS&details=outcomes&format=1QB");
 const render=()=>root.render(React.createElement(RankingsTable,{prospects}));await act(async()=>render());
 const toggle=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.startsWith("Advanced filters"))!;
 expect(toggle.getAttribute("aria-expanded")).toBe("false");expect(toggle.textContent).toContain("4 active");
 const panel=host.querySelector("#rankings-advanced-filters")!;expect(panel.classList.contains("hidden")).toBe(true);expect(panel.classList.contains("sm:flex")).toBe(true);
 await act(async()=>toggle.click());expect(toggle.getAttribute("aria-expanded")).toBe("true");
 const stage=Array.from(host.querySelectorAll("label")).find(l => l.querySelector(".sr-only")?.textContent === "Evaluation stage")!.querySelector("select")!;expect(stage.value).toBe("preDraft");
 await act(async()=>{stage.value="all";stage.dispatchEvent(new Event("change",{bubbles:true}));});await act(async()=>render());
 expect(toggle.textContent).toContain("3 active");expect(mocks.params.get("outcome")).toBe("MISS");expect(mocks.params.get("format")?.toLowerCase()).toBe("1qb");
 await act(async()=>toggle.click());await act(async()=>toggle.click());expect(Array.from(host.querySelectorAll("label")).find(l => l.querySelector(".sr-only")?.textContent === "Career outcome")!.querySelector("select")!.value).toBe("MISS");
 const clear=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.trim()==="Clear")!;await act(async()=>clear.click());await act(async()=>render());
 for(const key of ["tier","stage","outcome","details","q","position","page"])expect(mocks.params.has(key)).toBe(false);
 expect(mocks.params.get("format")?.toLowerCase()).toBe("1qb");expect(toggle.textContent).not.toContain("active");
});
it.each([8,12,16])("places all saved picks in the right team/round cells for a %i-team board",async teams=>{
 const picks=Array.from({length:teams*4},(_,i)=>({overall:i+1,playerId:`p${i+1}`,playerName:`Player ${i+1}`,position:"WR",userPick:i===1||i===teams+3,score:78.2})).reverse();
 await act(async()=>root.render(React.createElement(SavedDraftBoard,{picks,teams,slot:2,format:"SUPERFLEX_TEP"})));
 expect(host.querySelectorAll("th").length).toBe(teams);expect(host.querySelectorAll("tbody tr").length).toBe(4);
 expect(host.querySelectorAll("tbody td").length).toBe(teams*4);
 const secondRound=host.querySelectorAll("tbody tr")[1]!;expect(secondRound.querySelector("td")!.textContent).toContain(`Player ${teams+1}`);
 const links=Array.from(host.querySelectorAll("tbody a"));expect(links.filter(a=>a.textContent?.includes("Your pick")).length).toBe(2);
 expect(links[0]!.textContent).toContain("78.2");expect(links[0]!.getAttribute("href")).toContain("format=");
 expect(host.querySelector('[role="region"]')?.getAttribute("tabindex")).toBe("0");expect(fetch).not.toHaveBeenCalled();
});
it("handles drafts saved before full-room snapshots without fabricating a board",async()=>{
 await act(async()=>root.render(React.createElement(SavedDraftBoard,{teams:12,format:"SUPERFLEX"})));
 expect(host.textContent).toContain("not recorded");expect(host.querySelector("table")).toBeNull();
});
it("saves all picks with draft-time score, tier and image metadata for the grid",async()=>{
 const player:Prospect={id:"p1",name:"Saved Player",position:"WR",hasDraftData:false,preDraftScore:88,draftClass:"2027",photoUrl:"https://example.com/player.png"};
 await act(async()=>root.render(React.createElement(ResultsScreen,{
 draftId:"d7d4b050-569d-4b9e-b3a8-d727f959ffca",classYear:"2027",settings:{teams:12,slot:2,qbFormat:"SUPERFLEX",teFormat:"STANDARD",engine:"DD",pickTimer:"UNTIMED"},
 picks:[{overall:1,round:1,slot:1,playerId:"p1",userPick:false}],prospectById:new Map([["p1",player]]),gradeRows:[{pick:{overall:1,round:1,slot:1,playerId:"p1",userPick:true},player,grade:"A",valueGain:0,scoreGap:0,tierGap:0}],overallGrade:"A",ddValueCaptured:0,onReset:vi.fn(),onViewBoard:vi.fn()
 })));
 const call=vi.mocked(fetch).mock.calls.find(([url])=>url==="/api/mock-drafts")!;const payload=JSON.parse(call[1]!.body as string);
 expect(payload.settings.fullBoard[0]).toMatchObject({overall:1,playerName:"Saved Player",score:88,tier:"Elite",photoUrl:player.photoUrl,scoreLabel:"Pre-Draft",userPick:false});
 expect(payload.settings.slot).toBe(2);
});
