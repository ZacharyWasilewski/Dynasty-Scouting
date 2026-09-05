"use client";

import Link from "next/link";
import { ListOrdered, LogIn } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/components/auth/AuthProvider";

export function BoardIndexContent({ classYears }: { classYears: string[] }) {
  const { user, loading: authLoading } = useAuth();

  return (
    <main>
      <SectionIntro
        icon={ListOrdered}
        eyebrow="Your Rankings"
        title="My Big Board"
        description="Build your own personal ranking for any active draft class, starting from DD Score order. Only you see it."
        variant="utility"
      >
        <p className="text-sm text-ink-tertiary">
          Just want to bookmark a few players without ranking them?{" "}
          <Link href="/watchlist" className="text-accent hover:underline">
            Try your Watchlist
          </Link>
          .
        </p>
      </SectionIntro>
      <section className="py-10">
        <Container className="max-w-2xl">
          {authLoading ? (
            <div className="h-24" />
          ) : !user ? (
            <EmptyState
              icon={LogIn}
              title="Log in to build your own board."
              description="Reorder any class into your own personal ranking. It is saved to your account and visible only to you."
              action={{ label: "Log in", href: `/login?redirect=${encodeURIComponent("/board")}` }}
            />
          ) : (
            <>
              <div className="mb-5 border border-border bg-surface p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest2 text-accent">Build Your Big Board</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Start with Dynasty Database&apos;s rankings, then reorder a class into your own rookie board. Your changes are saved to your account and stay separate from the public DD rankings.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {classYears.map((year) => (
                <Link
                  key={year}
                  href={`/board/${year}`}
                  prefetch={false}
                  className="border border-border bg-surface px-4 py-5 text-center transition-colors duration-150 hover:border-accent/50"
                >
                  <span className="font-headline text-3xl leading-none text-ink">{year}</span>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                    Build board
                  </p>
                </Link>
              ))}
              </div>
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
