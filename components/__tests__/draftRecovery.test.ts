// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { MockDraftExperience } from "@/components/mockDraft/MockDraftExperience";
vi.mock("next/image",()=>({default:({unoptimized,fill,priority,...props}:any)=>React.createElement("img",props)}));
vi.mock("next/link",()=>({default:({children,prefetch,...props}:any)=>React.createElement("a",props,children)}));
vi.mock("@/components/auth/AuthProvider",()=>({useAuth:()=>({user:null,loading:false})}));
vi.mock("@/lib/globalFormat",()=>({getGlobalFormat:()=>"SUPERFLEX",reportFormatUsed:vi.fn()}));
vi.mock("@/lib/mockDraftSounds",()=>({playOnClockSound:vi.fn(),playPickSound:vi.fn(),playTickSound:vi.fn()}));
vi.mock("@/lib/track",()=>({track:vi.fn()}));
const prospects=Array.from({length:16},(_,i)=>({id:`p${i}`,name:`Player ${i}`,position:"WR" as const,draftClass:"2027",preDraftScore:90-i,hasDraftData:false}));
const settings={teams:8,qbFormat:"1QB",teFormat:"TEP",slot:1,engine:"DD",pickTimer:30};
const picks=[{overall:1,round:1,slot:1,playerId:"p0",userPick:true}];
let root:Root;let host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({})}));vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));Element.prototype.scrollTo=vi.fn();host=document.createElement("div");document.body.append(host);root=createRoot(host);localStorage.clear();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
function render(){return root.render(React.createElement(MockDraftExperience,{classProspectsByYear:{"2027":prospects},defaultClassYear:"2027",tierHitRatesByFormat:{}}));}
it("restores a paused draft without losing picks, queue, format or its original score snapshot",async()=>{
 localStorage.setItem("dd-mock-checkpoint-v1",JSON.stringify({version:1,id:"d7d4b050-569d-4b9e-b3a8-d727f959ffca",classYear:"2027",step:"draft",mode:"new",settings,picks,queue:["p3"],prospects:prospects.map(p=>({...p,preDraftScore:p.preDraftScore-10}))}));
 await act(async()=>render());
 expect(host.textContent).toContain("Draft restored and paused");expect(host.textContent).toContain("Player 0");
 const saved=JSON.parse(localStorage.getItem("dd-mock-checkpoint-v1")!);expect(saved.picks).toEqual(picks);expect(saved.queue).toEqual(["p3"]);expect(saved.settings.qbFormat).toBe("1QB");expect(saved.settings.teFormat).toBe("TEP");expect(saved.prospects[0].preDraftScore).toBe(80);
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>render());expect(host.textContent).toContain("Draft restored and paused");
});
it("restores completed guest results and leaves the full board reachable",async()=>{
 const complete=prospects.map((p,i)=>({overall:i+1,round:Math.floor(i/8)+1,slot:i%8+1,playerId:p.id,userPick:i%8===0}));
 localStorage.setItem("dd-mock-checkpoint-v1",JSON.stringify({version:1,id:"d7d4b050-569d-4b9e-b3a8-d727f959ffca",classYear:"2027",step:"results",mode:"new",settings,picks:complete,queue:[],prospects}));
 await act(async()=>render());expect(host.textContent).toContain("Draft complete");
 const board=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.includes("View draft board"));expect(board).toBeDefined();await act(async()=>board!.click());expect(host.textContent).toContain("Player 15");
});
