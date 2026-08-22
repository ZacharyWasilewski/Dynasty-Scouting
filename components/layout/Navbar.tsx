"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Users, Layers, BarChart3, GitCompareArrows, ClipboardList, Link2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { cn } from "@/lib/utils";

// Loosely grouped by the mental model a visitor actually moves
// through — discover players, decide what to do with a pick,
// then check whether the model actually holds up — rather than an
// arbitrary list. Team Sync was previously missing from this list
// entirely despite being a major, fully-built feature; there was no
// way to discover it existed from the desktop nav at all unless you
// happened to land on the homepage's tools section or a direct link.
const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  // Discover
  { label: "Players", href: "/players", icon: Users },
  { label: "Classes", href: "/classes", icon: Layers },
  { label: "Compare", href: "/compare", icon: GitCompareArrows },
  // Decide
  { label: "Mock Draft", href: "/mock-draft", icon: ClipboardList },
  { label: "Team Sync", href: "/team-sync", icon: Link2 },
  // Prove
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

/**
 * Below lg, navigation now lives entirely in BottomTabBar +
 * MobileMoreSheet — the hamburger-menu + separate profile-dropdown
 * pattern this used to have on mobile is gone. That's a deliberate
 * product decision, not just a layout tweak: a hamburger asks for two
 * taps (open, then pick) for every single navigation and hides itself
 * between uses, which fights against wanting mobile to be the primary
 * way people use this site. The top bar on mobile is now just the
 * logo — minimal chrome, since the bottom tab bar is the real nav.
 */
export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-void/80 backdrop-blur-md transition-shadow duration-300",
        scrolled ? "border-border shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)]" : "border-transparent"
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Dynasty Database home"
            className="group flex shrink-0 items-center gap-2.5 font-display text-lg font-semibold tracking-tightest text-ink transition-opacity hover:opacity-90"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/branding/dynasty-database-mark.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <span className="hidden sm:inline">DYNASTY DATABASE</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="group relative flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium transition-colors duration-200"
                >
                  <link.icon
                    className={cn(
                      "h-4 w-4 transition-all duration-200 group-hover:-translate-y-0.5",
                      active
                        ? "text-accent"
                        : "text-ink-tertiary group-hover:text-accent"
                    )}
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-ink" : "text-ink-secondary group-hover:text-ink"
                    )}
                  >
                    {link.label}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-1 left-3 right-3 h-[2px] origin-center scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100",
                      active && "scale-x-100"
                    )}
                  />
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {!authLoading && <ProfileMenu open={profileOpen} onOpenChange={setProfileOpen} />}
          </div>
        </nav>
      </Container>
    </header>
  );
}

