"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, ClipboardList, Search, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/components/search/SearchProvider";
import { MobileMoreSheet } from "@/components/layout/MobileMoreSheet";

/**
 * Mobile's real primary navigation. A hamburger menu asks someone to
 * make two taps (open menu, then pick a destination) for every single
 * navigation on the site, and hides itself between uses — the opposite
 * of what a frequently-used mobile product wants. A bottom tab bar
 * keeps the handful of highest-traffic destinations one tap away and
 * always visible, the same pattern every major native app (and
 * Sleeper's own app) uses. Hidden on /mock-draft, which already has
 * its own full-height fixed layout down to the bottom edge — a second
 * fixed bottom element there would fight it for space.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const { setOpen: setSearchOpen } = useSearch();
  const [moreOpen, setMoreOpen] = useState(false);

  if (pathname === "/mock-draft" || pathname.startsWith("/mock-draft/")) return null;

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
                className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-transform duration-100 active:scale-90"
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
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-transform duration-100 active:scale-90"
          >
            <Search className="h-5 w-5 text-ink-tertiary" strokeWidth={1.75} />
            <span className="text-ink-tertiary">Search</span>
          </button>

          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-expanded={moreOpen}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-transform duration-100 active:scale-90"
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
