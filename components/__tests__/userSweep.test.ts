// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import { PlayerPicker } from "@/components/comparison/PlayerPicker";
import { DialogSurface } from "@/components/ui/DialogSurface";
import { WatchlistProvider, useWatchlist } from "@/components/watchlist/WatchlistProvider";
const mocks=vi.hoisted(()=>({ params:new URLSearchParams("a=a&b=b&format=1qb-tep"), replace:vi.fn(), user:{id:"test-user"}}));
vi.mock("next/navigation",()=>({ useSearchParams:()=>mocks.params, useRouter:()=>({replace:mocks.replace}),usePathname:()=>"/compare" }));
vi.mock("next/link",()=>({default:({children,href,prefetch,...props}:any)=>React.createElement("a",{href,...props},children)}));
vi.mock("@/components/auth/AuthProvider",()=>({useAuth:()=>({user:mocks.user,loading:false})}));
vi.mock("@/lib/globalFormat",()=>({getGlobalFormat:()=>"SUPERFLEX",reportFormatUsed:vi.fn()}));
let root:Root;let host:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);mocks.replace.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const prospects=[{id:"a",name:"Alpha",position:"WR",hasDraftData:true,ddScore1QBTEP:90,preDraftScore:95},{id:"b",name:"Beta",position:"WR",hasDraftData:false,preDraftScore:80}];
it("preserves comparison IDs while the dataset loads, then restores both at the URL format",async()=>{
 let resolveData:((value:any)=>void)|undefined;
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("data-version")?{ok:true,json:async()=>({version:1})}:{ok:true,json:()=>new Promise(r=>{resolveData=r;})}));
 await act(async()=>root.render(React.createElement(ComparePage)));
 expect(mocks.replace).not.toHaveBeenCalled();
 await act(async()=>resolveData!({prospects,version:1}));
 expect(host.textContent).toContain("Alpha");expect(host.textContent).toContain("Beta");expect(host.textContent).toContain("Pre-Draft Score");expect(mocks.replace).not.toHaveBeenCalled();
});
it("supports keyboard-generated clicks on picker search results",async()=>{
 const selected=vi.fn();await act(async()=>root.render(React.createElement(PlayerPicker,{label:"Player A",prospects:prospects as any,selected:null,onSelect:selected})));
 const input=host.querySelector("input")!;
 await act(async()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Alpha");input.dispatchEvent(new Event("input",{bubbles:true}));});
 const result=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.includes("Alpha"));expect(result).toBeDefined();
 await act(async()=>{result!.focus();result!.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:0}));});expect(selected).toHaveBeenCalledWith(prospects[0]);
});
it("contains modal focus, handles Escape and restores the trigger and scroll",async()=>{
 vi.spyOn(HTMLElement.prototype,"getClientRects").mockReturnValue([{width:10,height:10}] as any);
 const trigger=document.createElement("button");document.body.append(trigger);trigger.focus();const close=vi.fn();
 await act(async()=>root.render(React.createElement(DialogSurface,{onClose:close,"aria-label":"Test"},React.createElement("button",null,"First"),React.createElement("button",null,"Last"))));
 const buttons=document.querySelectorAll('[role="dialog"] button');expect(document.activeElement).toBe(buttons[0]);
 (buttons[1] as HTMLElement).focus();document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));expect(document.activeElement).toBe(buttons[0]);
 document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));expect(close).toHaveBeenCalledOnce();
 await act(async()=>root.render(null));expect(document.activeElement).toBe(trigger);expect(document.body.style.overflow).toBe("");trigger.remove();
});
it("rolls back a failed watchlist save and prevents concurrent toggles",async()=>{
 let ctx:ReturnType<typeof useWatchlist>;let release:((v:any)=>void)|undefined;
 vi.stubGlobal("fetch",vi.fn(async(_url,init)=>!init?{ok:true,json:async()=>({ids:[]})}:new Promise(r=>{release=r;})));
 function Capture(){ctx=useWatchlist();return null;}
 await act(async()=>root.render(React.createElement(WatchlistProvider,null,React.createElement(Capture))));
 let saving:Promise<boolean>;await act(async()=>{saving=ctx!.toggle("a");});expect(ctx!.isSaved("a")).toBe(true);expect(await ctx!.toggle("a")).toBe(false);
 await act(async()=>{release!({ok:false});expect(await saving!).toBe(false);});expect(ctx!.isSaved("a")).toBe(false);expect(ctx!.pending.size).toBe(0);
});
