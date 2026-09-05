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
  LogOut,
  LogIn,
  UserPlus,
  BookOpen,
  Info,
  Target,
} from "@/components/ui/SiteIcons";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";

const DATABASE_LINKS = [
  { label: "Players", href: "/players", icon: ListOrdered },
  { label: "Classes", href: "/classes", icon: Layers },
];

const TOOL_LINKS = [
  { label: "Player Comparison", href: "/compare", icon: GitCompareArrows },
  { label: "Mock Draft", href: "/mock-draft", icon: ClipboardList },
  { label: "Big Board", href: "/board", icon: Target },
  { label: "Team Sync", href: "/team-sync", icon: Link2 },
];
// Big Board was already here on mobile — the desktop dropdown built
// separately (components/layout/Navbar.tsx) omitted it, so the same
// feature was one tap away on mobile and unreachable from the primary
// desktop nav (only findable via the account menu). Fixed on the
// desktop side to match, rather than removing it here.

const MODEL_LINKS = [
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Methodology", href: "/methodology", icon: BookOpen },
  // Was BookOpen here too — the same icon for two different concepts
  // right next to each other. Desktop already used Info for this one;
  // matched here instead of the other way around, since a shared icon
  // for two distinct items is the actual inconsistency to fix.
  { label: "Glossary", href: "/glossary", icon: Info },
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

        {/* Put the repeat-use destinations ahead of the site map. A signed-in
            user opening this sheet is much more likely to want their saved
            work than a second copy of a destination already in the tab bar. */}
        {!authLoading && user && (
          <div className="border-b border-border bg-surface-raised/35 p-3">
            <p className="truncate px-1 pb-2 font-mono text-[10px] text-ink-tertiary" title={user.email}>{user.email}</p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/my-stuff"
                onClick={handleLinkClick}
                className="flex min-h-12 items-center gap-2 border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:border-accent/40"
              >
                <LayoutGrid className="h-4 w-4 text-accent" strokeWidth={1.75} />
                My Stuff
              </Link>
              <Link
                href="/watchlist"
                onClick={handleLinkClick}
                className="flex min-h-12 items-center justify-between gap-2 border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:border-accent/40"
              >
                <span className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-accent" strokeWidth={1.75} />Watchlist</span>
                {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] text-white">{count}</span>}
              </Link>
            </div>
          </div>
        )}

        <div className="border-b border-border py-2">
          <p className="px-4 py-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Database</p>
          {DATABASE_LINKS.map((link) => (
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

        <div className="border-b border-border py-2">
          <p className="px-4 py-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Tools</p>
          {TOOL_LINKS.map((link) => (
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

        <div className="border-b border-border py-2">
          <p className="px-4 py-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-tertiary">Model</p>
          {MODEL_LINKS.map((link) => (
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

        <div className="py-2">
          {authLoading ? null : user ? (
            <>
              {/* Personal destinations live in the My Stuff hub above. Keep
                  this area intentionally to account actions so the sheet
                  does not repeat links users have already seen. */}
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
