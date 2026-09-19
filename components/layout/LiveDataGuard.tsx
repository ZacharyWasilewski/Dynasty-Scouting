"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Keeps long-lived client navigation from silently pinning a route to an old
 * RSC payload after the canonical sheet snapshot has advanced.
 *
 * This intentionally watches only the tiny version endpoint. Prospect data is
 * still fetched/rendered by the normal route, so a version change causes at
 * most one router.refresh() and never a background swap of half the UI.
 */
export function LiveDataGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const seenVersion = useRef<number | null>(null);
  const refreshQueued = useRef(false);
  const isDataRoute = pathname === "/" || /^(\/(players|classes|positions|analytics|mock-draft|board|watchlist|compare|team-sync|about|shared\/board|shared\/mock-draft|my-stuff))/.test(pathname);
  const lastInteractionAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshWhenIdle = useCallback(() => {
    if (refreshQueued.current) return;
    refreshQueued.current = true;
    const wait = Math.max(0, 1200 - (Date.now() - lastInteractionAt.current));
    timer.current = setTimeout(() => {
      refreshQueued.current = false;
      router.refresh();
    }, wait);
  }, [router]);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/data-version", { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json() as { version?: number | null };
      if (typeof body.version !== "number" || !Number.isFinite(body.version)) return;

      const previous = seenVersion.current;
      if (previous === null) {
        seenVersion.current = body.version;
        return;
      }
      // Versions are monotonic. A lower response can only be an older request
      // finishing after a newer one, never a reason to move the UI backward.
      if (body.version <= previous) return;
      seenVersion.current = body.version;
      // Static/auth pages have no prospect payload to update. Avoid needless
      // refreshes there so a background sheet update can never interrupt a
      // login, reset-password, or other unrelated form.
      if (isDataRoute) refreshWhenIdle();
    } catch {
      // The current route remains usable; a later navigation/focus check will
      // retry. Never clear live UI just because the tiny version probe failed.
    }
  }, [refreshWhenIdle, isDataRoute]);

  useEffect(() => {
    void checkVersion();
  }, [pathname, checkVersion]);

  useEffect(() => {
    const markInteraction = () => { lastInteractionAt.current = Date.now(); };
    const onFocus = () => { void checkVersion(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    // Poll less aggressively: focus/visibility changes still check immediately,
    // while an idle tab only performs one lightweight version request per minute
    // instead of every 15 seconds. This reduces background network/CPU work and
    // avoids needless contention with initial page and image loading.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkVersion();
    }, 60000);
    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [checkVersion]);

  return null;
}
