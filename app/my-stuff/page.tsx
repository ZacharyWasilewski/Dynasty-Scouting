"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ListOrdered, ClipboardList, Link2, LogIn, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWatchlist } from "@/components/watchlist/WatchlistProvider";
import { relativeTimeAgo } from "@/lib/utils";

interface CardStatus {
  loading: boolean;
  detail: string;
}

export default function MyStuffPage() {
  const { user, loading: authLoading } = useAuth();
  const { ids: watchlistIds, count: watchlistCount, hydrated: watchlistHydrated } = useWatchlist();

  const [boards, setBoards] = useState<CardStatus & { count: number }>({ loading: true, detail: "", count: 0 });
  const [drafts, setDrafts] = useState<CardStatus & { count: number }>({ loading: true, detail: "", count: 0 });
  const [teams, setTeams] = useState<CardStatus & { count: number; grade: string | null; moversCount: number }>({
    loading: true,
    detail: "",
    count: 0,
    grade: null,
    moversCount: 0,
  });
  // How many of the player's own watchlisted prospects have a
  // tracked Pre-Draft Score change — see /api/trending. Only devy
  // prospects ever have a delta (drafted players' DD Score is
  // settled), so this is naturally 0 for anyone whose watchlist is
  // all veterans, not a sign anything's broken.
  const [watchlistMoversCount, setWatchlistMoversCount] = useState<number | null>(null);
  // "Since you were last here" — see lib/usageTracking.ts for why
  // this has to read the OLD value before recording the new visit.
  // null means either not logged in yet, still loading, or this is
  // genuinely the user's first-ever visit — all three cases just
  // skip the callout rather than showing something misleading.
  const [previousVisit, setPreviousVisit] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/last-seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "my-stuff" }),
    })
      .then((r) => r.json())
      .then((d: { previousVisit: string | null }) => {
        if (d.previousVisit) setPreviousVisit(new Date(d.previousVisit));
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/board")
      .then((r) => r.json())
      .then((d: { classYears: string[] }) => {
        const n = d.classYears?.length ?? 0;
        setBoards({ loading: false, count: n, detail: n > 0 ? d.classYears.join(", ") : "" });
      })
      .catch(() => setBoards({ loading: false, count: 0, detail: "" }));

    fetch("/api/mock-drafts")
      .then((r) => r.json())
      .then((d: { drafts: unknown[] }) => {
        const n = d.drafts?.length ?? 0;
        setDrafts({ loading: false, count: n, detail: "" });
      })
      .catch(() => setDrafts({ loading: false, count: 0, detail: "" }));

    fetch("/api/sleeper?action=saved")
      .then((r) => r.json())
      .then((d: { teams: { leagueId: string; rosterId: number; teamName: string }[] }) => {
        const n = d.teams?.length ?? 0;
        const detail = n > 0 ? d.teams.map((t) => t.teamName).join(", ") : "";
        const mostRecent = d.teams?.[0];
        if (!mostRecent) {
          setTeams({ loading: false, count: n, detail, grade: null, moversCount: 0 });
          return;
        }
        // Full needs computation (grade + movers) for whichever team
        // was synced most recently — same "most recent wins" rule
        // Mock Draft's own synced-needs lookup already uses.
        fetch(`/api/sleeper?action=needs&leagueId=${mostRecent.leagueId}&rosterId=${mostRecent.rosterId}`)
          .then((r) => r.json())
          .then((needsData: { overallGrade?: { grade: string }; moversAtNeeds?: unknown[] }) => {
            setTeams({
              loading: false,
              count: n,
              detail,
              grade: needsData.overallGrade?.grade ?? null,
              moversCount: needsData.moversAtNeeds?.length ?? 0,
            });
          })
          .catch(() => setTeams({ loading: false, count: n, detail, grade: null, moversCount: 0 }));
      })
      .catch(() => setTeams({ loading: false, count: 0, detail: "", grade: null, moversCount: 0 }));
  }, [user]);

  useEffect(() => {
    if (!user || !watchlistHydrated || watchlistIds.size === 0) {
      setWatchlistMoversCount(watchlistHydrated ? 0 : null);
      return;
    }
    fetch("/api/trending")
      .then((r) => r.json())
      .then((d: { deltas: Record<string, number> }) => {
        const moved = Object.keys(d.deltas ?? {}).filter((id) => watchlistIds.has(id)).length;
        setWatchlistMoversCount(moved);
      })
      .catch(() => setWatchlistMoversCount(0));
  }, [user, watchlistHydrated, watchlistIds]);

  const watchlistStatus = watchlistCount === 0
    ? "Nothing saved yet"
    : watchlistMoversCount
      ? `${watchlistCount} player${watchlistCount === 1 ? "" : "s"} saved · ${watchlistMoversCount} moved recently`
      : `${watchlistCount} player${watchlistCount === 1 ? "" : "s"} saved`;

  const teamSyncStatus = teams.count === 0
    ? "Not synced yet"
    : [
        teams.grade ? `Grade: ${teams.grade}` : null,
        teams.moversCount > 0 ? `${teams.moversCount} mover${teams.moversCount === 1 ? "" : "s"} at your needs` : null,
        teams.detail,
      ].filter(Boolean).join(" · ");

  const cards = [
    {
      icon: Bookmark,
      title: "Watchlist",
      what: "A flat list of players you're keeping an eye on. No ranking, no ordering — just a quick bookmark.",
      href: "/watchlist",
      loading: !watchlistHydrated || watchlistMoversCount === null,
      status: watchlistStatus,
    },
    {
      icon: ListOrdered,
      title: "My Big Board",
      what: "Your own personal ranking for a draft class, reordered however you see it — starts from DD Score order.",
      href: "/board",
      loading: boards.loading,
      status: boards.count > 0 ? `${boards.count} board${boards.count === 1 ? "" : "s"} — ${boards.detail}` : "No boards started yet",
    },
    {
      icon: ClipboardList,
      title: "Mock Drafts",
      what: "Full mock drafts you've run against AI opponents. Every completed draft saves here automatically.",
      href: "/mock-drafts",
      loading: drafts.loading,
      status: drafts.count > 0 ? `${drafts.count} draft${drafts.count === 1 ? "" : "s"} completed` : "None completed yet",
    },
    {
      icon: Link2,
      title: "Team Sync",
      what: "Link a real Sleeper league so recommendations elsewhere on the site can target your actual roster needs.",
      href: "/team-sync",
      loading: teams.loading,
      status: teamSyncStatus,
    },
  ];

  return (
    <main>
      <SectionIntro
        icon={Bookmark}
        eyebrow="Your Account"
        title="My Stuff"
        description="Everything tied to your account, in one place — what each one is for, and what's changed since you last checked."
      />

      <section className="py-10">
        <Container className="max-w-3xl">
          {previousVisit && (
            <p className="mb-4 font-mono text-xs uppercase tracking-widest2 text-ink-tertiary">
              Since your last visit — {relativeTimeAgo(previousVisit)}
            </p>
          )}
          {authLoading ? (
            <div className="h-24" />
          ) : !user ? (
            <div className="flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
              <LogIn className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-secondary">Log in to see your saved stuff.</p>
              <Button href={`/login?redirect=${encodeURIComponent("/my-stuff")}`} className="mt-2">
                Log in
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group flex min-w-0 flex-col justify-between border border-border bg-surface p-5 transition-all duration-150 hover:border-accent/40 hover:bg-surface-raised active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
                        <card.icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="font-display text-base font-semibold text-ink">{card.title}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">{card.what}</p>
                  </div>
                  <div className="mt-4 flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest2 text-ink-secondary">
                      {card.loading ? "…" : card.status}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
