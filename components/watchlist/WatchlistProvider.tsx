"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

interface WatchlistContextValue {
  ids: Set<string>;
  isSaved: (id: string) => boolean;
  /** Only meaningful when logged in — WatchlistButton itself checks
   *  useAuth() and redirects to /login instead of calling this when
   *  there's no user, but this stays safe to call either way. */
  toggle: (id: string) => void;
  count: number;
  /** False until the initial fetch (or the "not logged in, so
   *  nothing to fetch" decision) resolves. */
  hydrated: boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/**
 * Saved players now live in Postgres, tied to the logged-in account —
 * this replaced an earlier localStorage-only version. Signed-out
 * visitors always see an empty, non-persisting list.
 */
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve before deciding what to fetch

    if (!user) {
      setIds(new Set());
      setHydrated(true);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data: { ids?: string[] }) => {
        if (!cancelled) setIds(new Set(data.ids ?? []));
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  function toggle(id: string) {
    if (!user) return; // WatchlistButton redirects to login before this can fire

    // Optimistic update — the UI responds immediately, and rolls back
    // only if the request actually fails.
    const wasSaved = ids.has(id);
    setIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
      })
      .catch(() => {
        setIds((prev) => {
          const reverted = new Set(prev);
          if (wasSaved) reverted.add(id);
          else reverted.delete(id);
          return reverted;
        });
      });
  }

  return (
    <WatchlistContext.Provider
      value={{ ids, isSaved: (id) => ids.has(id), toggle, count: ids.size, hydrated }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within a WatchlistProvider");
  return ctx;
}
