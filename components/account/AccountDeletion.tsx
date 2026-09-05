"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X, Loader2 } from "@/components/ui/SiteIcons";

export function AccountDeletion() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function closeDialog() {
    if (state === "deleting") return; // can't dismiss mid-request
    setOpen(false);
    setPassword("");
    setError(null);
    setState("idle");
  }

  // Same interaction pattern already established for every other
  // overlay on the site (MobileMoreSheet, ScoreRing's info popup):
  // Escape to dismiss, click the backdrop to dismiss, real
  // role="dialog" + aria-modal semantics.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDialog();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state]);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    // The real guard against a duplicate submission — the submit
    // button is also disabled while deleting, but this stops a second
    // Enter-key submit or a rapid double-click from firing twice.
    if (state === "deleting") return;

    setState("deleting");
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }
      // A hard navigation, not router.push — account deletion needs a
      // guaranteed full reset of every piece of client state
      // (AuthProvider's user object, WatchlistProvider's cached ids,
      // anything else in memory), not just a route change that could
      // leave stale references to the now-deleted account sitting
      // around in components that haven't re-fetched yet.
      window.location.href = "/";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  return (
    <div className="mt-10 border border-faller/30 bg-faller/[0.04] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-faller" strokeWidth={1.75} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-faller">Danger zone</p>
          <p className="mt-2 text-sm font-medium text-ink">Delete account</p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-tertiary">
            Permanently deletes your account, watchlist, saved boards, saved mock drafts, synced
            leagues, and preferences. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 border border-faller/40 px-3 py-2 text-xs font-semibold uppercase tracking-widest2 text-faller transition-colors duration-150 hover:bg-faller/10"
          >
            Delete account
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-heading"
            className="w-full max-w-sm border border-faller/40 bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <p id="delete-account-heading" className="text-base font-semibold text-ink">
                Delete your account?
              </p>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Cancel"
                className="p-1.5 text-ink-tertiary transition-colors duration-150 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-tertiary">
              This permanently removes your account and everything tied to it — watchlist, boards,
              saved mock drafts, synced leagues, preferences. There is no way to recover this.
            </p>

            <form onSubmit={handleDelete} className="mt-4">
              <label htmlFor="delete-password" className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
                Confirm your password
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="mt-1.5 w-full border border-border-strong bg-void px-3 py-2.5 text-base text-ink placeholder:text-ink-tertiary focus:border-faller/60 focus:outline-none focus:ring-2 focus:ring-faller/10"
              />

              {error && <p className="mt-2.5 text-xs text-faller">{error}</p>}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={state === "deleting"}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-widest2 text-ink-secondary transition-colors duration-150 hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={state === "deleting"}
                  className="flex items-center gap-2 border border-faller/50 bg-faller/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest2 text-faller transition-colors duration-150 hover:bg-faller/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state === "deleting" && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                  {state === "deleting" ? "Deleting…" : "Permanently delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
