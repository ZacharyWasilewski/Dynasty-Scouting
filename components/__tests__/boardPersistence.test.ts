// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { BoardEditor } from "@/components/board/BoardEditor";
const state=vi.hoisted(()=>({params:new URLSearchParams("format=sf"),user:{id:"owner"},router:{replace:vi.fn()}}));
vi.mock("next/navigation",()=>({useSearchParams:()=>state.params,useRouter:()=>state.router}));
vi.mock("next/link",()=>({default:({children,prefetch,...props}:any)=>React.createElement("a",props,children)}));
vi.mock("@/components/auth/AuthProvider",()=>({useAuth:()=>({user:state.user,loading:false})}));
vi.mock("@/lib/track",()=>({track:vi.fn()}));
let root:Root;let host:HTMLDivElement;let writes:string[][];
const prospects=[{id:"a",name:"Alpha",position:"WR" as const,ddScoreSuperflex:90,hasDraftData:true},{id:"b",name:"Beta",position:"WR" as const,ddScoreSuperflex:80,hasDraftData:true}];
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);localStorage.clear();writes=[];
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{if(init?.method==="PUT"){writes.push(JSON.parse(init.body as string).prospectIds);return {ok:true};}return {ok:true,json:async()=>url.includes("opportunity")?{overrides:{},scales:{},scores:{}}:{prospectIds:["a","b"]}};}));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(){root.render(React.createElement(BoardEditor,{classYear:"2027",prospects}));}
it("flushes the latest reorder when navigating away before the debounce fires",async()=>{
 await act(async()=>render());expect(writes).toEqual([]);
 const input=host.querySelector('input[aria-label="Move Alpha to rank"]') as HTMLInputElement;
 await act(async()=>{input.focus();input.value="2";input.blur();});expect(JSON.parse(localStorage.getItem("dd-board-pending:owner:2027")!)).toEqual(["b","a"]);
 await act(async()=>root.render(null));expect(writes.at(-1)).toEqual(["b","a"]);
});
it("restores pending edits over the older server order and retries the save",async()=>{
 localStorage.setItem("dd-board-pending:owner:2027",JSON.stringify(["b","a"]));await act(async()=>render());
 expect((host.querySelector('input[aria-label="Move Beta to rank"]') as HTMLInputElement).value).toBe("1");await act(async()=>root.render(null));expect(writes.at(-1)).toEqual(["b","a"]);
});
it("does not overwrite a saved board when its initial load fails",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false}));await act(async()=>render());expect(host.textContent).toContain("Could not load or save");expect(host.querySelector("fieldset")?.disabled).toBe(true);await act(async()=>root.render(null));expect(writes.length).toBe(0);
});
