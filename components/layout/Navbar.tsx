"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Layers, BarChart3, GitCompareArrows, ClipboardList, Link2,
  BookOpen, ChevronDown, ListOrdered, Search, Info, ClassMark, Target,
} from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearch } from "@/components/search/SearchProvider";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { cn } from "@/lib/utils";

/**
 * Nav groups.
 *
 * Group triggers are text-only by design. The previous version put an
 * icon on every trigger as well as a chevron, which put four unrelated
 * 16px glyphs in a row: at that size they read as visual noise rather
 * than as meaning, and "Database"/"Tools"/"Model" are already plain
 * enough that an icon adds nothing. Icons still appear inside the
 * dropdowns, where each one sits beside a label and description and
 * genuinely helps scanning.
 */
const NAV_GROUPS = [
  {
    label: "Database",
    links: [
      { label: "Players", description: "Search the full prospect database", href: "/players", icon: ListOrdered },
      { label: "Classes", description: "Explore current and future draft classes", href: "/classes", icon: Layers },
    ],
  },
  {
    label: "Tools",
    links: [
      { label: "Compare", description: "Compare two prospects side by side", href: "/compare", icon: GitCompareArrows },
      { label: "Mock Draft", description: "Practice against the live board", href: "/mock-draft", icon: ClipboardList },
      // Was missing entirely from this dropdown while already present in
      // MobileMoreSheet's own, separately maintained Tools list — the same
      // feature was one tap away on mobile and unreachable from primary
      // nav on desktop (only findable via the account menu).
      { label: "Big Board", description: "Build and rank your own personal board", href: "/board", icon: Target },
      { label: "Team Sync", description: "Connect your roster and draft context", href: "/team-sync", icon: Link2 },
    ],
  },
  {
    label: "Model",
    links: [
      { label: "Analytics", description: "Explore validation and historical results", href: "/analytics", icon: BarChart3 },
      { label: "Methodology", description: "Learn how Dynasty Database evaluates prospects", href: "/methodology", icon: BookOpen },
      { label: "Glossary", description: "Understand every score and term", href: "/glossary", icon: Info },
    ],
  },
];

export function Navbar({ featuredClassYear }: { featuredClassYear?: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { loading: authLoading } = useAuth();
  const { setOpen: setSearchOpen } = useSearch();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  // Without this the dropdowns only closed by re-clicking the same
  // button or navigating away — clicking anywhere else on the page
  // left the menu hanging open over the content.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const groupActive = (links: Array<{ href: string }>) => links.some((link) => isActive(link.href));
  const featuredHref = featuredClassYear ? `/classes/${featuredClassYear}` : null;
  const featuredActive = featuredHref ? pathname.startsWith(featuredHref) : false;

  return (
    <header
      className={cn(
        // Second attempt at this, and worth explaining why the first
        // one (bg-void/95) genuinely did not work: `void` is
        // registered in tailwind.config.ts as a bare
        // `var(--color-void)` reference, not the `rgb(var(...) /
        // <alpha-value>)` triplet format Tailwind's opacity modifiers
        // are actually built around. Whether that silently no-ops or
        // falls back to a color-mix() this browser doesn't render
        // the way expected, confirmed directly against a screenshot
        // that any opacity on this background is not reliable here.
        // Dropping the modifier entirely — bg-void with no
        // transparency — removes that uncertainty altogether: a
        // sticky, always-visible navbar's legibility is worth more
        // than a subtle frosted-glass effect that was never
        // confirmed to actually work.
        "sticky top-0 z-50 border-b bg-void transition-shadow duration-300",
        scrolled ? "border-border shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)]" : "border-transparent"
      )}
    >
      <Container>
        <nav className="flex h-16 items-center gap-4">
          <Link
            href="/"
            aria-label="Dynasty Database home"
            className="group flex shrink-0 items-center gap-2.5 font-display text-lg font-semibold tracking-tightest text-ink transition-opacity hover:opacity-90"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 group-hover:scale-105">
              <Image src="/branding/dynasty-database-mark.png" alt="" width={40} height={40} className="h-full w-full object-contain" priority />
            </span>
            <span className="hidden sm:inline">DYNASTY DATABASE</span>
          </Link>

          {/* Groups sit immediately after the wordmark rather than
              floating in the middle, so the bar reads as one connected
              unit instead of three widely separated islands. */}
          <div ref={navRef} className="hidden items-center gap-0.5 lg:ml-4 lg:flex">
            {NAV_GROUPS.map((group) => {
              const active = groupActive(group.links);
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    className={cn(
                      "relative flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                      active || open ? "text-ink" : "text-ink-secondary hover:text-ink",
                      open && "bg-surface-raised"
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-ink-tertiary transition-transform duration-200",
                        open && "rotate-180 text-ink-secondary"
                      )}
                    />
                    {/* Marks which section you're actually in — the old
                        bar only ever indicated this on the class link. */}
                    <span
                      className={cn(
                        "absolute -bottom-[13px] left-3 right-3 h-[2px] rounded-full bg-accent transition-transform duration-200",
                        active ? "scale-x-100" : "scale-x-0"
                      )}
                    />
                  </button>

                  {open && (
                    <div
                      role="menu"
                      className="absolute left-0 top-[calc(100%+12px)] w-[19rem] overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_24px_48px_-20px_rgba(0,0,0,0.75)]"
                    >
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                      <div className="p-2">
                        {group.links.map((link) => {
                          const LinkIcon = link.icon;
                          const linkActive = isActive(link.href);
                          return (
                            <Link
                              key={link.label}
                              href={link.href}
                              role="menuitem"
                              onClick={() => setOpenGroup(null)}
                              className={cn(
                                "group/item flex items-start gap-3 border-l border-transparent px-2.5 py-2.5 transition-colors duration-150",
                                linkActive ? "bg-surface-raised" : "hover:bg-surface-raised"
                              )}
                            >
                              <span
                                className={cn(
                                  "relative mt-px flex h-8 w-8 shrink-0 items-center justify-center border transition-colors duration-150",
                                  linkActive
                                    ? "border-accent/40 bg-accent/10 text-accent"
                                    : "border-border bg-void text-ink-tertiary group-hover/item:border-accent/30 group-hover/item:text-accent"
                                )}
                              >
                                <LinkIcon className="h-4 w-4" strokeWidth={1.75} />
                              </span>
                              <span className="min-w-0">
                                <span className={cn("block text-sm font-semibold", linkActive ? "text-accent" : "text-ink")}>
                                  {link.label}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-ink-tertiary">
                                  {link.description}
                                </span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Featured class, styled as a distinct shortcut rather than
                a fourth peer nav item. Previously it sat inline with the
                group triggers at a similar weight, so it read as a nav
                section that behaved differently from its neighbours for
                no visible reason. */}
            {featuredHref && (
              <Link
                href={featuredHref}
                aria-label={`Open ${featuredClassYear} class`}
                className={cn(
                  "group/featured hidden h-11 items-center gap-3 border-l border-accent/30 pl-3 pr-2 transition-colors duration-200 lg:flex",
                  featuredActive ? "text-accent" : "text-accent/90 hover:text-accent"
                )}
              >
                <span className="relative flex h-8 w-8 items-center justify-center border border-accent/30 bg-accent/[0.03] transition-colors duration-200 group-hover/featured:border-accent/60 group-hover/featured:bg-accent/10">
                  <ClassMark className="h-4 w-4" strokeWidth={1.6} />
                  <span className="absolute -right-px -top-px h-1.5 w-1.5 border-l border-b border-accent/60" aria-hidden="true" />
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-ink-tertiary">Current class</span>
                  <span className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.28em]">{featuredClassYear} class</span>
                </span>
                <span className="h-px w-4 bg-accent/50 transition-all duration-200 group-hover/featured:w-6" aria-hidden="true" />
              </Link>
            )}

            {/* Restores a visible way to search on desktop. Finding a
                player is the primary action on a prospect database, and
                the only entry point was an undiscoverable Cmd+K. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search prospects"
              className="hidden items-center gap-2 rounded-lg border border-border bg-surface/60 py-1.5 pl-2.5 pr-2 text-ink-tertiary transition-colors duration-200 hover:border-border-strong hover:text-ink-secondary lg:flex"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-sm">Search</span>
              <kbd className="ml-2 rounded border border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">
                ⌘K
              </kbd>
            </button>

            {!authLoading && <ProfileMenu open={profileOpen} onOpenChange={setProfileOpen} />}
          </div>
        </nav>
      </Container>
    </header>
  );
}
