"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * One small, shared "toast" system for the whole site — for a quick
 * confirmation like "Added to Watchlist" or "Big Board saved" that
 * shouldn't interrupt what the user's doing (no modal, no dialog,
 * nothing to dismiss). Mounted once in app/layout.tsx, alongside the
 * other site-wide providers (Auth/Watchlist/Search), so any client
 * component anywhere can call useToast() rather than each feature
 * (Watchlist, Big Board, Mock Draft, Team Sync) building its own.
 *
 * Auto-dismisses after 2.4s — long enough to read a short phrase,
 * short enough to not linger. Stacks if more than one fires close
 * together (e.g. rapid watchlist toggles) rather than replacing/
 * losing an earlier one.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-fade-in rounded-full border border-border-strong bg-surface-raised px-4 py-2 font-mono text-[11px] uppercase tracking-widest2 text-ink shadow-lg motion-reduce:animate-none"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
