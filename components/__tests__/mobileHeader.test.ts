// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Navbar } from "@/components/layout/Navbar";
import { forceHeaderCollapse, markProgrammaticScroll } from "@/lib/programmaticScroll";
import { InPageAnchor } from "@/components/ui/InPageAnchor";
vi.mock("next/navigation",()=>({usePathname:()=>"/players"}));
vi.mock("next/link",()=>({default:({children,prefetch,...props}:any)=>React.createElement("a",props,children)}));
vi.mock("next/image",()=>({default:({unoptimized,priority,fill,...props}:any)=>React.createElement("img",props)}));
vi.mock("@/components/auth/AuthProvider",()=>({useAuth:()=>({loading:false,user:{id:"user"}})}));
vi.mock("@/components/search/SearchProvider",()=>({useSearch:()=>({setOpen:vi.fn()})}));
vi.mock("@/components/layout/ProfileMenu",()=>({ProfileMenu:({open,onOpenChange}:any)=>React.createElement("button",{onClick:()=>onOpenChange(!open)},"Account")}));
let host:HTMLDivElement;let root:Root;
const header=()=>host.querySelector("header")!;
const hidden=()=>header().getAttribute("aria-hidden")==="true";
async function scroll(y:number){await act(async()=>{vi.stubGlobal("scrollY",y);window.dispatchEvent(new Event("scroll"));});}
async function advance(ms=400){await act(async()=>{vi.advanceTimersByTime(ms);});}
beforeEach(()=>{
  vi.useFakeTimers();vi.stubGlobal("requestAnimationFrame",(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),16));vi.stubGlobal("cancelAnimationFrame",clearTimeout);vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  vi.stubGlobal("innerWidth",390);vi.stubGlobal("innerHeight",800);vi.stubGlobal("scrollY",0);
  vi.spyOn(document.documentElement,"scrollHeight","get").mockReturnValue(3000);
  markProgrammaticScroll(0);host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();markProgrammaticScroll(0);});
it("slides without collapsing document space and ignores reversal noise during the transition",async()=>{
  await act(async()=>root.render(React.createElement(Navbar)));
  const spacer=header().previousElementSibling!;
  await scroll(180);expect(hidden()).toBe(true);expect(spacer.classList.contains("h-16")).toBe(true);
  expect(header().classList.contains("fixed")).toBe(true);expect(header().className).not.toContain("max-h-0");expect(header().hasAttribute("inert")).toBe(true);
  await scroll(160);expect(hidden()).toBe(true);
  await advance();await scroll(120);expect(hidden()).toBe(false);expect(document.documentElement.style.getPropertyValue("--nav-offset")).toBe("4rem");
  await scroll(0);expect(hidden()).toBe(false);
});
it("does not move controls during a press or collapse an open account menu",async()=>{
  await act(async()=>root.render(React.createElement(Navbar)));
  const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Account")!;
  button.dispatchEvent(new Event("pointerdown",{bubbles:true}));await scroll(150);expect(hidden()).toBe(false);
  document.dispatchEvent(new Event("pointerup"));await advance();
  await act(async()=>button.click());await scroll(250);expect(hidden()).toBe(false);
  await act(async()=>button.click());await scroll(300);expect(hidden()).toBe(true);
});
it("ignores bottom overscroll and reveals at the top even during a transition",async()=>{
  await act(async()=>root.render(React.createElement(Navbar)));
  await scroll(2200);await advance();await scroll(2300);await scroll(2200);expect(hidden()).toBe(true);
  await scroll(0);expect(hidden()).toBe(false);
});
it("keeps desktop visible and synchronizes forced mobile collapse with anchor offsets",async()=>{
  await act(async()=>root.render(React.createElement(Navbar)));
  await act(async()=>forceHeaderCollapse());expect(hidden()).toBe(true);expect(header().style.maxHeight).toBe("");
  expect(document.documentElement.style.getPropertyValue("--nav-offset")).toBe("0px");
  await act(async()=>{vi.stubGlobal("innerWidth",1280);window.dispatchEvent(new Event("resize"));});
  await act(async()=>forceHeaderCollapse());await scroll(500);expect(hidden()).toBe(false);
  expect(document.documentElement.style.getPropertyValue("--nav-offset")).toBe("4rem");
});
it("subtracts only the visible header when jumping to an anchor",async()=>{
  const anchorProps = {targetId:"target", children:"Jump"};
  vi.stubGlobal("matchMedia",()=>({matches:false}));const scrollTo=vi.fn();vi.stubGlobal("scrollTo",scrollTo);
  await act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(Navbar),React.createElement(InPageAnchor,anchorProps),React.createElement("div",{id:"target"}))));
  vi.spyOn(header(),"getBoundingClientRect").mockReturnValue({height:64,bottom:0} as DOMRect);
  vi.spyOn(host.querySelector("#target")!,"getBoundingClientRect").mockReturnValue({top:500} as DOMRect);
  await act(async()=>Array.from(host.querySelectorAll("a")).find(a=>a.textContent==="Jump")!.click());await advance(50);
  expect(scrollTo).toHaveBeenCalledWith({top:500,behavior:"smooth"});
});
