"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial /api/auth/me check completes — lets UI
   *  avoid flashing a "logged out" state for someone who's actually
   *  logged in, just before the check resolves. */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Sets the user directly from a response that already returned
   *  one (login/signup) — skips an otherwise-redundant follow-up
   *  fetch to /api/auth/me for data the client already has. */
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Sign-in check failed");
      const data = await res.json();
      if (!data || !("user" in data)) throw new Error("Invalid sign-in response");
      setError(null);
      setUser(data.user ?? null);
    } catch {
      setError("Couldn’t check your sign-in status. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) throw new Error("Couldn’t log out. Please try again.");
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, setUser: (next) => { setUser(next); setError(null); }, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
