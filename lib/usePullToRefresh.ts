import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD_PX = 70;
// Resistance so a full-length physical drag doesn't map 1:1 to pull
// distance — a real pull-to-refresh should feel like pulling against
// something, not dragging a free object.
const RESISTANCE = 0.45;
const MAX_PULL_PX = 110;

interface Options {
  onRefresh: () => Promise<void>;
  /** Disables the gesture entirely — e.g. while a modal/overlay is
   *  open on top of the list, or on desktop where this hook shouldn't
   *  attach touch listeners that would never fire anyway but could
   *  still interfere with mouse-drag text selection. */
  disabled?: boolean;
}

/**
 * Touch-only by design — this hook only ever listens for
 * touchstart/touchmove/touchend, never mouse or pointer events, so it
 * has zero effect on desktop regardless of whether it's mounted.
 *
 * Only begins tracking a pull when window.scrollY is already 0 at
 * touchstart, and immediately abandons tracking the moment the page
 * scrolls away from the top — this is what keeps ordinary scrolling
 * completely unaffected: the gesture only ever activates at the exact
 * top-of-page moment a real pull-to-refresh should.
 */
export function usePullToRefresh({ onRefresh, disabled }: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Real refs, kept in sync below — the touch listeners are attached
  // once (their own effect only depends on `disabled`) and read these
  // on every event, rather than closing over whatever
  // pullDistance/refreshing/onRefresh happened to be at attach time.
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    function handleTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) {
        trackingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? null;
      trackingRef.current = true;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!trackingRef.current || startYRef.current === null) return;
      // The page scrolled away from the top mid-gesture (e.g. content
      // above shifted) — abandon rather than keep pulling against a
      // page that's no longer at the top.
      if (window.scrollY > 0) {
        trackingRef.current = false;
        setPullDistance(0);
        return;
      }
      const currentY = e.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Only actually intercept the gesture (preventDefault) once
      // it's unambiguously a downward pull past a small dead zone —
      // this is what keeps a normal upward scroll or a tiny
      // accidental touch from ever being affected.
      if (delta > 8) {
        e.preventDefault();
        setPullDistance(Math.min(delta * RESISTANCE, MAX_PULL_PX));
      }
    }

    async function handleTouchEnd() {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      const distance = pullDistanceRef.current;
      startYRef.current = null;
      if (distance >= PULL_THRESHOLD_PX && !refreshingRef.current) {
        setRefreshing(true);
        setPullDistance(PULL_THRESHOLD_PX);
        try {
          await onRefreshRef.current();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    }

    // { passive: false } is required for preventDefault to have any
    // effect on touchmove — the default passive listener can't block
    // the browser's own scroll/native-pull-refresh behavior at all.
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled]);

  return { pullDistance, refreshing, threshold: PULL_THRESHOLD_PX };
}
