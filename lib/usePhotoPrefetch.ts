import { useEffect, useRef } from "react";

// A tiny in-memory set, not per-component state — the same photo URL
// can appear in multiple lists on the same page (e.g. Similar
// Prospects reusing a player already shown in Rankings), and there's
// no reason to ever prefetch the same URL twice in one session.
const alreadyPrefetched = new Set<string>();

function prefetchImage(url: string) {
  if (alreadyPrefetched.has(url)) return;
  alreadyPrefetched.add(url);
  // A plain Image object, never attached to the DOM — this exists
  // purely to make the browser issue the request and cache the
  // response. No unoptimized/Next-proxy mismatch to worry about
  // here: every photo <Image> on the site already renders with
  // `unoptimized` (confirmed site-wide), meaning the real <img> tag
  // requests this exact URL too — so this prefetch is a guaranteed
  // cache hit for the real render, not a near-miss.
  const img = new window.Image();
  img.src = url;
}

/**
 * Attach the returned ref to a row's outer element and pass its
 * player's photo URL. The photo fetch starts once that row is within
 * `rootMargin` of the viewport (currently a generous 800px below the
 * fold) — not on mount, so scrolling through hundreds of ranked
 * players doesn't fire hundreds of simultaneous image requests, only
 * the ones actually about to be seen. Each row unobserves itself
 * immediately after its first intersection; there's nothing to keep
 * watching once the prefetch has fired.
 */
export function usePhotoPrefetch<T extends HTMLElement>(photoUrl: string | undefined | null) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!photoUrl) return;
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver isn't available during SSR, and some very
    // old browsers lack it entirely — in that case just skip
    // prefetching rather than throw. The real photo still loads
    // normally on the profile page either way; this is purely an
    // optimization layer, never something the page depends on.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetchImage(photoUrl);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [photoUrl]);

  return ref;
}
