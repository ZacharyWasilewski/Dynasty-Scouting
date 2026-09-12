"use client";

import type { MouseEvent, ReactNode } from "react";
import { markProgrammaticScroll } from "@/lib/programmaticScroll";

/**
 * A same-page "jump to section" link that behaves like a real <a
 * href="#section">, but doesn't push a new browser-history entry for
 * every click the way a native hash link does.
 *
 * That native behavior was the actual cause of a reported bug: on
 * the player profile, clicking through Overview → Progression →
 * Comps → Draft and then hitting the browser Back button stepped
 * back through those *hash changes* one at a time instead of
 * leaving the page — because each click of a plain `href="#id"`
 * anchor is, to the browser, an equivalent action to a real page
 * navigation. Sitewide, this pattern showed up in exactly three
 * places: this component now covers all three (the profile page's
 * Overview/Progression/Comps/Draft nav, the Analytics page's
 * Performance/Score Quality/Historical quick-nav, and one "See the
 * full backtest" link) — one shared fix rather than three separate,
 * possibly-inconsistent patches.
 *
 * `href` is still set (real hash, real target) so a right-click/
 * open-in-new-tab, a JS-disabled fallback, and search engines still
 * see a normal link — but the click itself is intercepted to do a
 * plain, non-history-mutating scroll instead. `onBeforeScroll` runs
 * first for callers (like the profile tabs) that also need to swap
 * which panel is showing before the scroll happens.
 */
export function InPageAnchor({
  targetId,
  onBeforeScroll,
  scrollOnMobile = true,
  extraOffsetId,
  className,
  children,
  ...rest
}: {
  targetId: string;
  onBeforeScroll?: () => void;
  /**
   * Set false when the target content already renders right where
   * the link itself sits on mobile (e.g. a tab bar whose panels
   * swap in place, collapsing everything but the active one to zero
   * height) — scrolling in that case only pushes the link/nav itself
   * off-screen for no benefit, which is exactly what happened on the
   * player profile's Overview/Progression/Comps/Draft tabs: picking
   * a tab scrolled the tab bar itself out of view, so cycling
   * through tabs meant scrolling back up before every single tap.
   * Desktop is unaffected either way, since it never hides content —
   * true there is what makes the Analytics quick-nav and the "See
   * the full backtest" link still scroll correctly on mobile too,
   * where their target sections are genuinely elsewhere on the page.
   */
  /** id of a second sticky element (e.g. the profile page's own tab
   *  bar) whose current, *live* rendered height should also be
   *  reserved above the scroll target, on top of the main header's.
   *  Only the profile tabs need this — other InPageAnchor call sites
   *  (Analytics' quick-nav, Methodology's deep links, pagination)
   *  have no second bar below the header, so they leave this unset. */
  extraOffsetId?: string;
  className?: string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Modified clicks (cmd/ctrl/middle-click "open in new tab", etc.)
    // should keep working exactly like a normal link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    onBeforeScroll?.();

    if (!scrollOnMobile && !window.matchMedia("(min-width: 640px)").matches) return;

    // Deferred two frames — see markProgrammaticScroll below for why
    // this alone was never actually the fix, but it's still correct
    // and harmless to keep: onBeforeScroll may be a state setter (the
    // profile tabs use it to swap which panel is visible), and this
    // gives React a couple of frames to commit that before anything
    // below tries to find/measure the result.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(targetId);
        if (!el) return;
        markProgrammaticScroll();

        // Manually computed, not el.scrollIntoView() + CSS
        // scroll-margin-top — after three attempts at making the
        // *timing* around a CSS-variable-driven scroll-margin
        // reliable (a settle check, a forced-before-scroll collapse,
        // an instant collapse, a second animation frame), a change
        // that should have been decisive by any reasonable accounting
        // (direct DOM manipulation + forced synchronous reflow,
        // called before this ever runs) *still* left a measurable gap
        // on the exact same two tabs and nowhere else. That pattern —
        // fixes that provably ran, in the right order, with no
        // remaining timing gap, and still no change — means the
        // remaining suspect isn't timing at all, it's scroll-margin-
        // top itself: there's no hard guarantee that a
        // calc(var(--x)+Npx) scroll-margin is re-resolved against the
        // *current* value of --x at the exact moment scrollIntoView
        // reads it, on every engine, rather than some other cached
        // resolution point. Measuring live positions directly here
        // and calling plain window.scrollTo() removes that dependency
        // entirely — getBoundingClientRect() cannot return a stale
        // answer; it's a fresh measurement from the browser's actual,
        // current layout, not a resolved-and-possibly-cached CSS value.
        const headerEl = document.getElementById("site-header");
        const headerOffset = headerEl ? headerEl.getBoundingClientRect().height : 0;
        const extraEl = extraOffsetId ? document.getElementById(extraOffsetId) : null;
        const extraOffset = extraEl ? extraEl.getBoundingClientRect().height : 0;
        const targetY = window.scrollY + el.getBoundingClientRect().top - headerOffset - extraOffset;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, targetY), behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  return (
    <a href={`#${targetId}`} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
}
