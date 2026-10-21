"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Fire-and-forget — a failed registration (unsupported browser,
    // blocked by an extension, etc.) should never affect the actual
    // page, since the service worker is purely an installability/
    // static-asset-caching layer, not something any page logic
    // depends on to function.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
