"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { User, LayoutGrid, Bookmark, ListOrdered, ClipboardList, Link2, ShieldCheck, LogOut, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";

/**
 * One circular trigger for both states — logged in or not. Signed
 * out, it opens Log in / Sign up instead of an account menu, so the
 * navbar never has to show two separate buttons for this.
 *
 * Open state is controlled by the parent (Navbar) rather than fully
 * internal, so Navbar can force this closed when the hamburger menu
 * opens — on mobile the two used to be fully independent, which let
 * both pop open on top of each other at once.
 *
 * Every menu-item Link closes the menu via a deferred setTimeout(...,
 * 0) rather than calling onOpenChange directly in the same click.
 * Closing synchronously re-renders (and can unmount) this dropdown
 * within the same click event Next.js's own <Link> handler is still
 * processing to trigger navigation — on some mobile browsers that
 * race can eat the tap entirely, leaving the link looking dead. Same
 * defer-to-next-tick fix already used in PlayerPicker.tsx for an
 * analogous timing conflict.
 */
export function ProfileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, logout } = useAuth();
  const { count } = useWatchlist();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onOpenChange]);

  const initial = user?.email.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface font-mono text-xs font-semibold text-ink-secondary transition-colors duration-200 hover:border-accent/50 hover:text-accent"
      >
        {initial ?? <User className="h-4 w-4" strokeWidth={1.75} />}
      </button>

      {open &&
        (user ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 border border-border bg-surface shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate font-mono text-xs text-ink-tertiary" title={user.email}>
                {user.email}
              </p>
            </div>
            <Link
              href="/my-stuff"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 border-b border-border bg-surface-raised/40 px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface-raised"
            >
              <LayoutGrid className="h-4 w-4 text-accent" strokeWidth={1.75} />
              My Stuff
            </Link>
            <Link
              href="/watchlist"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <span className="flex items-center gap-2">
                <Bookmark className="h-4 w-4" strokeWidth={1.75} />
                Watchlist
              </span>
              {count > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold text-void">
                  {count}
                </span>
              )}
            </Link>
            <Link
              href="/board"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
              My Big Board
            </Link>
            <Link
              href="/mock-drafts"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
              Mock Drafts
            </Link>
            <Link
              href="/team-sync"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <Link2 className="h-4 w-4" strokeWidth={1.75} />
              Team Sync
            </Link>
            {user.isAdmin && (
              <Link
                href="/admin/status"
                role="menuitem"
                onClick={() => setTimeout(() => onOpenChange(false), 0)}
                className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                Admin Status
              </Link>
            )}
            <button
              role="menuitem"
              onClick={() => {
                onOpenChange(false);
                logout();
              }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Log out
            </button>
          </div>
        ) : (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-48 border border-border bg-surface shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]"
          >
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <LogIn className="h-4 w-4" strokeWidth={1.75} />
              Log in
            </Link>
            <Link
              href="/signup"
              role="menuitem"
              onClick={() => setTimeout(() => onOpenChange(false), 0)}
              className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <UserPlus className="h-4 w-4" strokeWidth={1.75} />
              Sign up
            </Link>
          </div>
        ))}
    </div>
  );
}
