"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

interface WatchlistContextValue {
  ids: Set<string>;
  isSaved: (id: string) => boolean;
  /** Only meaningful when logged in — WatchlistButton itself checks
   *  useAuth() and redirects to /login instead of calling this when
   *  there's no user, but this stays safe to call either way. */
  toggle: (id: string) => Promise<boolean>;
  pending: Set<string>;
  loadError: boolean;
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
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);
    fetch("/api/watchlist")
      .then((res) => { if (!res.ok) throw new Error("Load failed"); return res.json(); })
      .then((data: { ids?: string[] }) => {
        if (!cancelled) setIds(new Set(data.ids ?? []));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function toggle(id: string): Promise<boolean> {
    if (!user || !hydrated || loadError || inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setPending(new Set(inFlight.current));
    const savingUserId = user.id;
    const wasSaved = ids.has(id);
    setIds(prev => { const next = new Set(prev); wasSaved ? next.delete(id) : next.add(id); return next; });
    try {
      const res = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId: id, saved: !wasSaved }) });
      if (!res.ok) throw new Error("Save failed");
      return true;
    } catch {
      if (activeUserId.current === savingUserId) setIds(prev => { const next = new Set(prev); wasSaved ? next.add(id) : next.delete(id); return next; });
      return false;
    } finally {
      inFlight.current.delete(id);
      setPending(new Set(inFlight.current));
    }
  }

  return (
    <WatchlistContext.Provider
      value={{ pending, loadError, ids, isSaved: (id) => ids.has(id), toggle, count: ids.size, hydrated }}
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
