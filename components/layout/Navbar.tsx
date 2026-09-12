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
import { isProgrammaticScroll, refreshProgrammaticScroll, registerHeaderHiddenSetter } from "@/lib/programmaticScroll";

/**
 * Nav groups.
 *
 * Group triggers are text-only by design. The previous version put an
 * icon on every trigger as well as a chevron, which put four unrelated
 * 16px glyphs in a row: at that size they read as visual noise rather
 * than as meaning, and "Database"/"Tools"/"Research" are already plain
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
    label: "Research",
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

  // Mobile only (lg:!translate-y-0 below hard-overrides this on
  // desktop regardless of state) — hides on scroll down, reappears on
  // scroll up. On long pages (player profiles, Rankings, Research
  // Center, Methodology, Glossary, Big Board) this header plus the
  // fixed bottom tab bar were permanently claiming a meaningful slice
  // of a phone's vertical space; this gives that back while someone's
  // actively reading, without removing the header or its navigation.
  //
  // lastY is a ref, not state — this fires on every scroll event, and
  // putting the running comparison value in state would mean a
  // re-render (and a new effect run, since handleScroll would close
  // over stale state otherwise) on every single one.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const lastCheckAt = useRef(0);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors profileOpen into a ref the scroll handler can read live —
  // the scroll effect below only attaches its listener once (empty
  // dependency array), so reading `profileOpen` directly inside it
  // would close over the initial `false` forever.
  const profileOpenRef = useRef(false);
  useEffect(() => {
    profileOpenRef.current = profileOpen;
  }, [profileOpen]);

  // Registers this component's setHidden with programmaticScroll.ts
  // so forceHeaderCollapse() can keep React's own state in sync after
  // it's already done the actual, timing-critical work of collapsing
  // the header directly on the DOM (see that function's own comment
  // for why it works that way now, after two prior versions that
  // trusted React's state/effect/rAF timing to land in the right
  // order, and measurably didn't). All this side does is make sure
  // `hidden` reflects reality afterward, for whenever this component
  // next needs to reason about its own state (e.g. the settle check
  // below, or a future organic scroll).
  useEffect(() => {
    return registerHeaderHiddenSetter(setHidden);
  }, []);


  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      setScrolled(y > 8);

      // Only ever activates below the lg breakpoint (1024px) — the
      // header is forced permanently visible on desktop via
      // lg:!translate-y-0 on the element itself, so letting this
      // state go true there would desync it from --nav-offset below
      // for no reason (the CSS override means it wouldn't even be
      // visible as a bug, but the variable would still be wrong for
      // any sticky element reading it on a wide viewport).
      if (window.innerWidth >= 1024) return;

      // A tap on something like the profile tabs triggers its own
      // scrollIntoView(), which fires this exact same scroll event —
      // without this check, tapping a tab would pop the header back
      // in or hide it as a pure side effect of the resulting scroll
      // direction, confirmed directly from a recording: tapping
      // "Overview" scrolled upward to reach it, which this listener
      // read as the user scrolling up and revealed the header, even
      // though nothing about the tap was asking for that.
      //
      // refreshProgrammaticScroll() re-arms the window on every event
      // that fires while it's active, so the suppression lasts as
      // long as the scroll animation actually runs rather than a
      // fixed guess — a fixed 700ms was too short for a long jump
      // (e.g. Comps/Draft back up to Overview/Progression, which
      // covers much more of the page than the reverse), and once it
      // expired mid-scroll the header would reappear before the
      // scroll had finished landing, leaving a gap where it reclaimed
      // space the already-computed landing position hadn't planned
      // for — reported directly as "Overview and Progression leave a
      // gap, the other two don't," which is exactly the asymmetry
      // this predicts.
      //
      // Still tracks lastY through the programmatic window (just
      // skips acting on it) — skipping that too would leave the next
      // *genuine* scroll's delta measured against a stale position
      // from before the jump, which could read as a large, spurious
      // movement in whatever direction the jump happened to go.
      if (isProgrammaticScroll()) {
        refreshProgrammaticScroll();
        lastY.current = y;
        // The actual bug behind the reported gap: suppressing the
        // hide/show decision for the *whole* scroll (correctly, to
        // stop it reacting to the jump's own direction) means nothing
        // ever runs that decision again once the animation's events
        // stop coming in — it was staying frozen at whatever it was
        // *before* the tap, however wrong that was for where the page
        // actually landed. This schedules one explicit settle check
        // ~450ms after the *last* scroll event seen (cleared and
        // reset on every qualifying event, so it only actually fires
        // once scrolling has genuinely stopped), which corrects
        // `hidden` to match the real final position regardless of
        // how the browser happened to space out events along the way
        // — that timing varied by distance, which is exactly why
        // this only showed up for two of the four tabs and not the
        // other two: not a difference in the tabs themselves, just in
        // how far each one's jump happened to scroll.
        if (settleTimeout.current) clearTimeout(settleTimeout.current);
        settleTimeout.current = setTimeout(() => {
          const finalY = window.scrollY;
          setHidden(finalY > 64);
          lastY.current = finalY;
        }, 450);
        return;
      }

      // The profile dropdown (ProfileMenu) renders as an absolutely-
      // positioned child of this header, extending below its own box
      // on purpose — collapsing the header's max-height out from
      // under it while it's open would clip it. Narrow edge case
      // (has to be open *and* the page scrolled while it's open) but
      // a real one, and cheap to just not collapse while it's open.
      if (profileOpenRef.current) {
        lastY.current = y;
        return;
      }

      // Throttled to at most once every 120ms, not evaluated on every
      // single scroll event — a fast flick/momentum scroll on iOS
      // fires many events in quick succession, and the *instantaneous*
      // delta between two consecutive ones can flip sign from pure
      // sub-pixel/deceleration noise, which read as the header
      // rapidly hiding and revealing itself ("bounces all over the
      // place," reported directly). Comparing over a slightly longer
      // window smooths that out while staying responsive — 120ms is
      // well under the point a person would notice as a delay.
      const now = Date.now();
      if (now - lastCheckAt.current < 120) return;
      lastCheckAt.current = now;

      // Two more guards: never hide until scrolled past the header's
      // own height (so a small bounce right at the top of the page
      // can't hide it), and require a real net movement — bumped from
      // 10px to 20px alongside the throttle above, since comparing
      // over a longer time window means normal scrolling naturally
      // covers more distance between checks too.
      const delta = y - lastY.current;
      if (Math.abs(delta) > 20) {
        if (delta > 0 && y > 64) setHidden(true);
        else if (delta < 0) setHidden(false);
        lastY.current = y;
      }
    }
    // Resetting on resize covers a real, if narrow, edge case: rotate
    // or resize from mobile to a desktop width while `hidden` was
    // true, and without this it would stay stuck true — invisible on
    // screen (the lg: CSS override hides the bug), but --nav-offset
    // would stay wrong at 0px for any sticky element reading it,
    // since nothing else would ever flip `hidden` back on a desktop
    // viewport (the guard above returns before it can).
    function handleResize() {
      if (window.innerWidth >= 1024) setHidden(false);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--nav-offset", hidden ? "0px" : "4rem");
  }, [hidden]);

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
      id="site-header"
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
        //
        // max-height, not a transform — this was the actual bug
        // behind two separate reports ("Overview/Progression leave a
        // gap" and "scrolling up fast is messy/bouncy"). `transform`
        // is purely visual: it never affects layout, so translating
        // the header off-screen left its real 64px box still sitting
        // in the document flow, invisible but still occupying space —
        // "hiding" it was never actually reclaiming any room, just
        // hiding the bar while a phantom gap stayed behind where it
        // used to be. Every sticky element below it (the tab bar, the
        // Analytics quick-nav) then had to scroll past that invisible
        // box before reaching its own target position, which is
        // exactly what the reported gap was, and repeated rapidly
        // during a fast scroll is exactly what looked like bouncing.
        // Collapsing max-height instead genuinely shrinks the box to
        // zero, so hidden actually means zero space, not just zero
        // opacity — overflow-hidden clips the header's own content
        // during the collapse so it doesn't spill out below.
        // overflow-hidden only below lg: needed there so the header's
        // content doesn't spill out visibly during the max-height
        // collapse, but the desktop nav's dropdown panels (rendered
        // as absolutely-positioned descendants of this same <header>,
        // extending below its own box on purpose) would get clipped
        // by it too if it applied at lg: — where the collapse
        // behavior itself never runs anyway. overflow-visible there
        // restores normal behavior for those dropdowns.
        // Forced pre-scroll collapses now happen via direct DOM
        // manipulation in forceHeaderCollapse() (programmaticScroll.ts),
        // not through this className — that function sets its own
        // inline transition:none + max-height:0 synchronously, forces
        // a reflow, then clears those inline overrides a frame later
        // once React's className already agrees. So this className
        // only ever needs to handle the normal, organic-scroll case,
        // and can just always use the real animated transition.
        // Each property gets the same 300ms duration — the tab bar
        // below (and the Analytics quick-nav, same pattern) both
        // animate their own `top: var(--nav-offset)` position on a
        // matching transition now too, specifically so they move in
        // sync with this header's own collapse/reveal instead of
        // snapping to their new position instantly while the header
        // is still mid-animation. That mismatch — the header slowly
        // growing while everything below it had already jumped to its
        // final position — is almost certainly what read as
        // "jittery" before, not the header's own duration; a shorter
        // duration only made the mismatched window shorter, it never
        // actually fixed the mismatch itself.
        "sticky top-0 z-50 overflow-hidden bg-void transition-[max-height,box-shadow,border-color] duration-300 lg:!max-h-16 lg:overflow-visible",
        hidden ? "max-h-0 border-b border-transparent" : cn("max-h-16 border-b", scrolled ? "border-border shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)]" : "border-transparent")
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
                  <span className="mt-1 font-mono tabular-nums text-[11px] font-semibold uppercase tracking-[0.28em]">{featuredClassYear} class</span>
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
