"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, LogIn, Link2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { Button } from "@/components/ui/Button";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Prospect } from "@/types/prospect";

export function WatchlistContent({ prospects }: { prospects: Prospect[] }) {
  const { user, loading: authLoading } = useAuth();
  const { ids, hydrated } = useWatchlist();
  const saved = prospects.filter((p) => ids.has(p.id));

  // Cross-references the watchlist against a synced team's real
  // needs, the same connective pattern already used between Trending
  // and Team Sync — the point being that these features shouldn't
  // read as unrelated rooms with no doors between them. Only fetched
  // once the watchlist itself has real players to check against.
  const [neededPositions, setNeededPositions] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!user || saved.length === 0) return;
    fetch("/api/sleeper?action=saved")
      .then((r) => r.json())
      .then((d: { teams: { leagueId: string; rosterId: number }[] }) => {
        const mostRecent = d.teams?.[0];
        if (!mostRecent) return;
        return fetch(`/api/sleeper?action=needs&leagueId=${mostRecent.leagueId}&rosterId=${mostRecent.rosterId}`)
          .then((r) => r.json())
          .then((needsData: { needs?: { position: string; needScore: number }[] }) => {
            const needed = needsData.needs?.filter((n) => n.needScore > 0).map((n) => n.position) ?? [];
            setNeededPositions(new Set(needed));
          });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, saved.length]);

  const matchingNeeds = neededPositions ? saved.filter((p) => neededPositions.has(p.position)) : [];

  return (
    <main>
      <SectionIntro
        icon={Bookmark}
        eyebrow="Your List"
        title="Watchlist"
        description="Players you've saved to your account. Tap the bookmark icon on any player to add or remove them."
      >
        <p className="text-sm text-ink-tertiary">
          Looking to build your own ranked order instead of a flat saved list?{" "}
          <Link href="/board" className="text-accent hover:underline">
            Try My Big Board
          </Link>
          .
        </p>
      </SectionIntro>
      <section className="py-10">
        <Container>
          {authLoading ? (
            <div className="h-24" />
          ) : !user ? (
            <div className="flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
              <LogIn className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-secondary">
                Log in to see your watchlist.
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                Saved players are tied to your account, so they follow
                you across devices.
              </p>
              <Button href={`/login?redirect=${encodeURIComponent("/watchlist")}`} className="mt-2">
                Log in
              </Button>
            </div>
          ) : !hydrated ? (
            <div className="h-24" />
          ) : saved.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
              <Bookmark className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-secondary">
                Your watchlist is empty for now.
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                Tap the bookmark icon next to any player — on their profile, or in any rankings table — to keep
                track of them here.
              </p>
              <Button href="/players" className="mt-2">
                Browse players
              </Button>
            </div>
          ) : (
            <>
              {matchingNeeds.length > 0 && (
                <div className="mb-4 flex items-start gap-3 border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-ink-secondary">
                    <span className="font-semibold text-ink">
                      {matchingNeeds.length} player{matchingNeeds.length === 1 ? "" : "s"} on this list
                    </span>{" "}
                    play{matchingNeeds.length === 1 ? "s" : ""} a position your synced team actually needs —{" "}
                    <Link href="/team-sync" className="text-accent hover:underline">
                      see the full breakdown
                    </Link>
                    .
                  </p>
                </div>
              )}
              {/* rankScope is left at its default (each player's real,
                  site-wide rank) rather than "collection" — a watchlist
                  should show where a saved player actually ranks
                  overall, not a 1-N renumbering just among your list. */}
              <RankingsTable prospects={saved} showClassColumn />
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
