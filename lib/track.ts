"use client";

/**
 * Fire-and-forget usage event. Safe to call from anywhere client-side
 * — never throws, never awaited by the caller, and `keepalive: true`
 * lets the request survive a navigation that happens immediately
 * after (e.g. tracking a click right before following its own link).
 */
export function track(eventType: string, path?: string) {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, path: path ?? window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Fetch itself can throw synchronously in rare environments
    // (e.g. no network stack available) — never worth surfacing.
  }
}
