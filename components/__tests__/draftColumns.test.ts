// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvailablePlayerRow } from "@/components/mockDraft/AvailablePlayerRow";
let root:Root;let host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it.each([true,false])("keeps numeric tokens whole and only allows picks on the user's turn (%s)",async canPick=>{
 const makePick=vi.fn(),toggleQueued=vi.fn();
 const p={id:"long-name",name:"Christopher Long-Name Jr.",position:"WR" as const,hasDraftData:false,preDraftScore:100,subScores:[{label:"Breakout Age",value:100}]};
 await act(async()=>root.render(React.createElement(AvailablePlayerRow,{p,rank:1000,score:100,tier:"Generational",cr:1141,diff:0,canPick,isSuggested:false,positionTierHitRates:new Map([["preDraft:WR:Generational",100],["sample:preDraft:WR:Generational",1141]]),queue:[],toggleQueued,setExpandedPlayerId:vi.fn(),closePlayerSearch:vi.fn(),makePick})));
 const stats=Array.from(host.querySelectorAll('.mock-player-stat p')); expect(stats.some(p=>p.textContent==='100% (n=1141)')).toBe(true);
 for(const stat of stats){expect(stat.classList.contains('whitespace-nowrap')).toBe(true);expect(stat.classList.contains('break-words')).toBe(false);}
 const pick=host.querySelector('[aria-label="Pick Christopher Long-Name Jr."]') as HTMLButtonElement|null;expect(Boolean(pick)).toBe(canPick);
 if(pick){await act(async()=>pick.click());expect(makePick).toHaveBeenCalledWith(p,true);}
 await act(async()=>(host.querySelector('[aria-label="Add Christopher Long-Name Jr. to queue"]') as HTMLButtonElement).click());expect(toggleQueued).toHaveBeenCalledWith(p.id);
});
