// @vitest-environment jsdom
import React, {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {AuthProvider,useAuth} from "@/components/auth/AuthProvider";
import {SavedMockDraftsContent} from "@/components/mockDrafts/SavedMockDraftsContent";
import {TierHitRateInfo} from "@/components/profile/TierHitRateInfo";
vi.mock("next/link",()=>({default:({children,...props}:any)=>React.createElement("a",props,children)}));
let host:HTMLDivElement;let root:Root;let auth:ReturnType<typeof useAuth>;
function withAuth(children: React.ReactNode) { const props = {children}; return React.createElement(AuthProvider, props); }
function Probe(){auth=useAuth();return React.createElement("span",null,auth.user?.email??auth.error??"signed out");}
const user={id:"u1",email:"test@example.com",isAdmin:false};
const response=(data:unknown,ok=true)=>({ok,json:async()=>data});
beforeEach(()=>{
 vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("retains a known account on failed refresh and failed logout, clearing it only after successful logout",async()=>{
 const fetcher=vi.fn().mockResolvedValue(response({user}));vi.stubGlobal("fetch",fetcher);
 await act(async()=>root.render(withAuth(React.createElement(Probe))));
 expect(auth.user?.id).toBe("u1");
 fetcher.mockResolvedValue(response({},false));
 await act(async()=>auth.refresh());expect(auth.user?.id).toBe("u1");expect(auth.error).toBeTruthy();
 await act(async()=>{await expect(auth.logout()).rejects.toThrow();});expect(auth.user?.id).toBe("u1");
 fetcher.mockResolvedValue(response({ok:true}));await act(async()=>auth.logout());expect(auth.user).toBeNull();
});
it("distinguishes a failed initial sign-in check and allows retry",async()=>{
 const fetcher=vi.fn().mockRejectedValue(new Error("offline"));vi.stubGlobal("fetch",fetcher);
 await act(async()=>root.render(withAuth(React.createElement(Probe))));
 expect(host.textContent).toContain("Couldn’t check");
 fetcher.mockResolvedValue(response({user}));await act(async()=>auth.refresh());
 expect(host.textContent).toBe(user.email);expect(auth.error).toBeNull();
});
it("shows a load error instead of empty draft history, retries, and preserves drafts after failed deletion",async()=>{
 const draft={id:"d1",classYear:"2027",settings:{teams:12,qbFormat:"SUPERFLEX",teFormat:"STANDARD"},overallGrade:"A",createdAt:"2026-09-17T16:00:00Z"};
 let loadFails=true;let deleteFails=true;
 const fetcher=vi.fn(async(url:string,options?:RequestInit)=>url==="/api/auth/me"?response({user}):options?.method==="DELETE"?response({},!deleteFails):response(loadFails?{}:{drafts:[draft]},!loadFails));
 vi.stubGlobal("fetch",fetcher);
 await act(async()=>root.render(withAuth(React.createElement(SavedMockDraftsContent))));
 expect(host.textContent).toContain("Couldn’t load");expect(host.textContent).not.toContain("will show up here");
 loadFails=false;await act(async()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Retry")!.click());
 expect(host.textContent).toContain("2027 Mock Draft");
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete this saved draft"]')!.click());
 expect(fetcher.mock.calls.some(([,options])=>options?.method==="DELETE")).toBe(false);
 confirm.mockReturnValue(true);
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete this saved draft"]')!.click());
 expect(host.textContent).toContain("Couldn’t delete");expect(host.textContent).toContain("2027 Mock Draft");
 deleteFails=false;await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete this saved draft"]')!.click());
 expect(host.textContent).not.toContain("2027 Mock Draft");expect(host.textContent).toContain("will show up here");
});
it("opens tier help by tapping and closes it with Escape",async()=>{
 await act(async()=>root.render(React.createElement(TierHitRateInfo,{stage:"Pre-Draft",position:"WR",tier:"Elite",format:"Superflex",count:7})));
 const trigger=host.querySelector("button")!;trigger.focus();await act(async()=>trigger.click());
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain("7 resolved prospects");
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain("RP pushes");
 await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
 expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(trigger);
});
