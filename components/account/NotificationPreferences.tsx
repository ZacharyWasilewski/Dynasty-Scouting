"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "@/components/ui/SiteIcons";

export function NotificationPreferences() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(data.enabled ?? false);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle() {
    if (saving) return; // guards against a rapid double-tap firing two conflicting requests
    const next = !enabled;
    setEnabled(next); // optimistic — reverted below only if the request actually fails
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(!next);
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Notifications</p>
          <p className="mt-2 text-sm font-medium text-ink">Watchlist alerts</p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-tertiary">
            Get an email when a player on your watchlist changes tier or moves meaningfully in DD
            Score. Uses whatever format you have saved, checked roughly every 30 minutes.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Watchlist alerts"
          onClick={handleToggle}
          disabled={loading || saving}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 disabled:opacity-50 ${
            enabled ? "border-accent bg-accent/20" : "border-border-strong bg-surface-raised"
          }`}
        >
          {loading || saving ? (
            <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-ink-tertiary" strokeWidth={2.5} />
          ) : (
            <span
              className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-ink transition-transform duration-150 ${
                enabled ? "translate-x-[22px] bg-accent" : "translate-x-0.5 bg-ink-tertiary"
              }`}
            />
          )}
        </button>
      </div>
    </div>
  );
}
