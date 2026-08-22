"use client";

import Link from "next/link";
import { ListOrdered, LogIn } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

export function BoardIndexContent({ classYears }: { classYears: string[] }) {
  const { user, loading: authLoading } = useAuth();

  return (
    <main>
      <SectionIntro
        icon={ListOrdered}
        eyebrow="Your Rankings"
        title="My Big Board"
        description="Build your own personal ranking for this year's class or next year's devy class, starting from DD Score order. Only you see it."
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
            <div className="flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center">
              <LogIn className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-secondary">
                Log in to build your own board.
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">
                Reorder any class into your own personal ranking —
                saved to your account, visible only to you.
              </p>
              <Button href={`/login?redirect=${encodeURIComponent("/board")}`} className="mt-2">
                Log in
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {classYears.map((year) => (
                <Link
                  key={year}
                  href={`/board/${year}`}
                  className="border border-border bg-surface px-4 py-5 text-center transition-colors duration-150 hover:border-accent/50"
                >
                  <span className="font-headline text-3xl leading-none text-ink">{year}</span>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                    Build board
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
