"use client";

import { useEffect } from "react";
import { markPopState } from "@/lib/formatPersistence";

// Mounted once in the root layout, which never unmounts across
// client-side route changes — so this listener is never subject to a
// race against any individual page's own mount/unmount order. It just
// timestamps every real Back/Forward so listing pages can tell "I'm
// mounting because of an actual Back button" apart from a fresh visit,
// a reload, or a normal link click.
export function BackNavTracker() {
  useEffect(() => {
    window.addEventListener("popstate", markPopState);
    return () => window.removeEventListener("popstate", markPopState);
  }, []);

  return null;
}
