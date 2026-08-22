"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  Layers,
  GitCompareArrows,
  BarChart3,
  LayoutGrid,
  Bookmark,
  ListOrdered,
  ClipboardList,
  Link2,
  ShieldCheck,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";

const MORE_LINKS = [
  { label: "Classes", href: "/classes", icon: Layers },
  { label: "Player Comparison", href: "/compare", icon: GitCompareArrows },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout, loading: authLoading } = useAuth();
  const { count } = useWatchlist();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Same deferred-close reasoning as ProfileMenu.tsx — closing
  // synchronously in the same click Next.js's <Link> is still
  // processing to navigate can eat the tap on some mobile browsers.
  function handleLinkClick() {
    setTimeout(onClose, 0);
  }

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-void/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-slide-up absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t border-border-strong bg-surface [animation-duration:200ms]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">Menu</span>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-tertiary hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col py-2">
          {MORE_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={handleLinkClick}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
            >
              <link.icon className="h-4 w-4" strokeWidth={1.75} />
              {link.label}
            </Link>
          ))}
        </div>

        <div className="border-t border-border py-2">
          {authLoading ? null : user ? (
            <>
              <div className="px-4 py-2">
                <p className="truncate font-mono text-xs text-ink-tertiary" title={user.email}>
                  {user.email}
                </p>
              </div>
              <Link
                href="/my-stuff"
                onClick={handleLinkClick}
                className="flex items-center gap-3 bg-surface-raised/40 px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface-raised"
              >
                <LayoutGrid className="h-4 w-4 text-accent" strokeWidth={1.75} />
                My Stuff
              </Link>
              <Link
                href="/watchlist"
                onClick={handleLinkClick}
                className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <span className="flex items-center gap-3">
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
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
                My Big Board
              </Link>
              <Link
                href="/mock-drafts"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
                Mock Drafts
              </Link>
              <Link
                href="/team-sync"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <Link2 className="h-4 w-4" strokeWidth={1.75} />
                Team Sync
              </Link>
              {user.isAdmin && (
                <Link
                  href="/admin/status"
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
                >
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                  Admin Status
                </Link>
              )}
              <button
                onClick={() => {
                  handleLinkClick();
                  logout();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <LogIn className="h-4 w-4" strokeWidth={1.75} />
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
