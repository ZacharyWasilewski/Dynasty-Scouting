"use client";

import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export function WatchlistButton({
  prospectId,
  className,
  iconClassName,
}: {
  prospectId: string;
  className?: string;
  iconClassName?: string;
}) {
  const { isSaved, toggle, hydrated } = useWatchlist();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const saved = isSaved(prospectId);

  return (
    <button
      type="button"
      onClick={(e) => {
        // Rows and headers often sit right next to (or inside the
        // same clickable area as) a player's profile link — this
        // keeps a tap on the star from also triggering navigation.
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
        track(saved ? "watchlist_remove" : "watchlist_add");
        toggle(prospectId);
      }}
      aria-pressed={saved}
      aria-label={
        !user
          ? "Log in to save players"
          : saved
          ? "Remove from watchlist"
          : "Add to watchlist"
      }
      title={
        !user
          ? "Log in to save players"
          : saved
          ? "Remove from watchlist"
          : "Add to watchlist"
      }
      // Invisible (not just disabled-looking) until auth + the real
      // saved state both resolve, so nobody sees a star flash as
      // "unsaved" for a player they actually already saved. Default
      // padding turns the 16px icon into a real touch target —
      // without it, the tappable area is just the icon's own tiny
      // bounding box, which is hard to hit accurately on mobile.
      className={cn(
        "flex items-center justify-center p-2 -m-2 text-ink-tertiary transition-all duration-150 hover:text-accent active:scale-90",
        saved && "text-accent",
        (!hydrated || authLoading) && "invisible",
        className
      )}
    >
      <Bookmark className={cn("h-4 w-4", iconClassName)} fill={saved ? "currentColor" : "none"} strokeWidth={1.75} />
    </button>
  );
}
