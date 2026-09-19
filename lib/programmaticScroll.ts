/**
 * A plain module-level flag, not React state/context — this needs to
 * be readable synchronously inside a scroll event handler (Navbar's),
 * set by a completely separate component (InPageAnchor) that has no
 * other relationship to it. Context would work but is overkill for
 * one imperative signal neither side needs to re-render on.
 *
 * Lets Navbar's scroll-direction listener (used to hide/reveal the
 * header on mobile) tell the difference between a person actually
 * scrolling to read the page and a scrollIntoView() call triggered by
 * tapping something like the player-profile tabs. Without this, tab
 * clicks were popping the header in and out as a side effect —
 * confirmed directly from a screen recording: tapping "Overview"
 * scrolled upward to reach that panel's content, and the header's own
 * listener read that motion as the user scrolling up and revealed
 * itself, even though nothing about the click was asking for that.
 *
 * A sliding window, not a fixed-duration one-shot timer: refreshScroll()
 * re-arms the window on every scroll event that fires while it's
 * still active, so the suppression naturally lasts exactly as long as
 * the browser is still animating the scroll — however long that
 * actually takes — and only expires once scrolling has genuinely
 * stopped. A fixed timer (originally 700ms) was too short for long
 * jumps specifically: scrolling from a later tab (Comps/Draft) back
 * up to an earlier one (Overview/Progression) covers much more of the
 * page, so the animation reliably outlasted a flat 700ms, the
 * suppression expired mid-scroll, and the header would reappear
 * before the scroll had actually finished landing — leaving a gap
 * where it reclaimed space the already-computed landing position
 * hadn't accounted for. Reported directly as "Overview and
 * Progression leave a gap, the other two don't" — which matches
 * exactly, since jumping to those two is disproportionately more
 * likely to be the longer, slower scroll.
 */
let programmaticUntil = 0;

/** Call right before triggering any scrollIntoView()/scrollTo() that
 *  isn't a direct response to the user dragging/flicking the page. */
export function markProgrammaticScroll(durationMs = 700) {
  programmaticUntil = Date.now() + durationMs;
}

/** Call from inside a scroll listener, once per event, while
 *  isProgrammaticScroll() is still true — keeps the window alive for
 *  as long as the animated scroll keeps producing scroll events. */
export function refreshProgrammaticScroll(durationMs = 400) {
  programmaticUntil = Date.now() + durationMs;
}

export function isProgrammaticScroll(): boolean {
  return Date.now() < programmaticUntil;
}

// Anchor navigation collapses the fixed mobile header synchronously so
// destinations use the final sticky offset. Document height never changes.
let reactHiddenSetter: ((hidden: boolean) => void) | null = null;
export function registerHeaderHiddenSetter(setter: (hidden: boolean) => void) {
  reactHiddenSetter = setter;
  return () => { if (reactHiddenSetter === setter) reactHiddenSetter = null; };
}
export function forceHeaderCollapse() {
  if (window.innerWidth >= 1024) return;
  const header = document.getElementById("site-header");
  if (header) {
    header.style.transition = "none";
    header.style.transform = "translateY(-100%)";
    document.documentElement.style.setProperty("--nav-offset", "0px");
    void header.offsetHeight;
    requestAnimationFrame(() => {
      header.style.transition = "";
      header.style.transform = "";
    });
  }
  reactHiddenSetter?.(true);
}
