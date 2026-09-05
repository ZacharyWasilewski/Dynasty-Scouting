"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, ClipboardList, Search, Menu } from "@/components/ui/SiteIcons";
import { cn } from "@/lib/utils";
import { useSearch } from "@/components/search/SearchProvider";
import { MobileMoreSheet } from "@/components/layout/MobileMoreSheet";
import { getMockDraftStep, MOCK_DRAFT_STEP_EVENT, type MockDraftStep } from "@/lib/mockDraftStep";

/**
 * Mobile's real primary navigation. A hamburger menu asks someone to
 * make two taps (open menu, then pick a destination) for every single
 * navigation on the site, and hides itself between uses — the opposite
 * of what a frequently-used mobile product wants. A bottom tab bar
 * keeps the handful of highest-traffic destinations one tap away and
 * always visible, the same pattern every major native app (and
 * Sleeper's own app) uses.
 *
 * Hidden during the live draft and results screens on /mock-draft,
 * which take over the full height for the draft board and picks list
 * — a second fixed bottom element there would fight it for space.
 * Shown again on the setup screen, which is a normal in-flow page
 * with real bottom padding of its own, same as everywhere else.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const { setOpen: setSearchOpen } = useSearch();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mockDraftStep, setMockDraftStepState] = useState<MockDraftStep | null>(() => getMockDraftStep());

  useEffect(() => {
    function sync() {
      setMockDraftStepState(getMockDraftStep());
    }
    window.addEventListener(MOCK_DRAFT_STEP_EVENT, sync);
    return () => window.removeEventListener(MOCK_DRAFT_STEP_EVENT, sync);
  }, []);

  const onMockDraft = pathname === "/mock-draft" || pathname.startsWith("/mock-draft/");
  // Before MockDraftExperience's own effect has fired (the very first
  // paint on a fresh load), no signal has been received yet — default
  // to "setup" rather than hidden, since that's the actual starting
  // step and assuming hidden would flash the bar away and back a
  // moment later instead of just staying put.
  if (onMockDraft && (mockDraftStep === "draft" || mockDraftStep === "results")) return null;

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const tabs = [
    { label: "Home", href: "/", icon: Home },
    { label: "Players", href: "/players", icon: Users },
    { label: "Mock Draft", href: "/mock-draft", icon: ClipboardList },
  ];

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-void/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "m-1 flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-transform duration-100 active:scale-90",
                  active && "bg-accent/10"
                )}
              >
                <tab.icon
                  className={cn("h-5 w-5 transition-colors duration-150", active ? "text-accent" : "text-ink-tertiary")}
                  strokeWidth={active ? 2 : 1.75}
                />
                <span className={cn("transition-colors duration-150", active ? "text-ink" : "text-ink-tertiary")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="m-1 flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-transform duration-100 active:scale-90"
          >
            <Search className="h-5 w-5 text-ink-tertiary" strokeWidth={1.75} />
            <span className="text-ink-tertiary">Search</span>
          </button>

          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-expanded={moreOpen}
            className="m-1 flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-transform duration-100 active:scale-90"
          >
            <Menu className="h-5 w-5 text-ink-tertiary" strokeWidth={1.75} />
            <span className="text-ink-tertiary">More</span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
