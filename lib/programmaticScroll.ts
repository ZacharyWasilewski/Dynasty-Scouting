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

/**
 * A separate, one-shot signal from the "am I mid-scroll" flag above —
 * this tells Navbar to collapse *before* a scroll starts, not after
 * it lands. Went through two prior versions of this that both turned
 * out wrong in the same underlying way — trusting React's state
 * update, its effect that syncs --nav-offset, and requestAnimationFrame
 * timing to all land in the right order relative to when the scroll
 * target actually gets computed. Confirmed directly by measuring
 * actual pixel positions in screenshots (not eyeballing it) that
 * neither a second animation frame nor an instant (transition-none)
 * collapse meaningfully changed the size of the gap — which means the
 * problem was never really about timing at all, it was about
 * *certainty*: React's render/commit cycle doesn't guarantee exactly
 * when a style change is actually reflected in layout relative to
 * other async work.
 *
 * This version sidesteps that entirely: it manipulates the header's
 * DOM node directly and forces a synchronous layout recalculation
 * (reading `.offsetHeight`, a standard, well-defined way to make the
 * browser apply any pending style changes immediately rather than at
 * its own next convenience) before returning. By the time this
 * function's caller moves on to compute a scroll target, the header
 * is *certainly* collapsed — not "should be, assuming everything
 * else lands in the expected order."
 *
 * React's own `hidden` state is still updated too (so Navbar's normal
 * scroll-driven logic stays consistent afterward), but the state
 * setter's effects are no longer what this depends on for
 * correctness.
 */
let reactHiddenSetter: ((hidden: boolean) => void) | null = null;

/** Navbar registers its setHidden here on mount so forceHeaderCollapse
 *  can keep React's own state in sync after doing the real work
 *  directly on the DOM. */
export function registerHeaderHiddenSetter(setter: (hidden: boolean) => void) {
  reactHiddenSetter = setter;
  return () => {
    if (reactHiddenSetter === setter) reactHiddenSetter = null;
  };
}

export function forceHeaderCollapse() {
  const header = document.getElementById("site-header");
  if (header) {
    header.style.transition = "none";
    header.style.maxHeight = "0px";
    header.style.borderBottomColor = "transparent";
    // Forces the browser to apply the two style changes above right
    // now, synchronously, instead of at its own next opportunity —
    // reading a layout-dependent property is what makes that happen.
    // The read result is thrown away; only the side effect matters.
    void header.offsetHeight;
    document.documentElement.style.setProperty("--nav-offset", "0px");

    // Inline styles beat className on specificity, so left in place
    // permanently they'd freeze the header's transition off forever —
    // breaking the smooth slide for every future *organic* hide/show.
    // One frame is enough to clear them: by then React (via
    // reactHiddenSetter, called synchronously below, in the same
    // tick as the direct DOM writes above) has already re-rendered
    // with hidden=true, so the className alone already says
    // max-height:0/border-transparent — removing the inline
    // overrides just hands control back to it with no visual change,
    // it doesn't undo the collapse itself.
    requestAnimationFrame(() => {
      header.style.transition = "";
      header.style.maxHeight = "";
      header.style.borderBottomColor = "";
    });
  }
  reactHiddenSetter?.(true);
}
