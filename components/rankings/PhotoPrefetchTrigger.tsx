import { usePhotoPrefetch } from "@/lib/usePhotoPrefetch";

/**
 * Renders nothing visible — exists only so a hook that depends on
 * IntersectionObserver can be called once per row inside a plain
 * .map() loop. Rows in RankingsTable render inline, not as their own
 * components, so usePhotoPrefetch can't be called directly inside
 * the map callback (that would violate React's rules of hooks, which
 * require the same hooks to run in the same order every render — a
 * loop body doesn't guarantee that). Dropping this as an extra child
 * of each row gives the hook a real per-row component instance to
 * live in, without restructuring how the row itself renders.
 */
export function PhotoPrefetchTrigger({ photoUrl }: { photoUrl: string | undefined | null }) {
  const ref = usePhotoPrefetch<HTMLSpanElement>(photoUrl);
  // Deliberately NOT position:absolute — that would position this
  // relative to the nearest positioned ancestor, which may not be
  // the row itself, silently detaching this trigger from the row's
  // actual on-screen location and making the whole prefetch
  // meaningless (watching the wrong spot). A 1x1px element left in
  // normal document flow is what stays guaranteed to sit exactly
  // where the row places it.
  //
  // display:block, not inline-block — this was the actual bug behind
  // a real, reported gap appearing between every row. inline-block
  // still participates in inline formatting context line-height
  // calculations regardless of its own explicit height, so even at
  // h-px this was reserving real vertical space governed by the
  // surrounding font metrics, not by its own 1px size. block removes
  // it from that inline formatting context entirely — no line-height
  // contribution, while still being a normal-flow, correctly-
  // positioned element for the IntersectionObserver above.
  return <span ref={ref} aria-hidden="true" className="block h-px w-px overflow-hidden" />;
}
