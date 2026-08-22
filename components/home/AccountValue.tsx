import Link from "next/link";
import { Bookmark, ListOrdered, Link2, LayoutGrid } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

const VALUE_ITEMS = [
  {
    icon: Bookmark,
    title: "Watchlist",
    description: "Save any prospect from anywhere on the site — see it change alongside every other saved player in one place.",
  },
  {
    icon: ListOrdered,
    title: "Your Own Big Board",
    description: "Reorder any class into your own ranking, starting from the model's board as a baseline.",
  },
  {
    icon: Link2,
    title: "Team Sync",
    description: "Link your real Sleeper league — get a real grade and draft recommendations built around your actual roster, not a generic one.",
  },
  {
    icon: LayoutGrid,
    title: "My Stuff",
    description: "One dashboard for everything you've saved, with what's changed since you last checked.",
  },
];

/**
 * A deliberately different shape from every other section on this
 * page (not a card grid, not a stat grid, not a comparison table) —
 * a value list paired with a direct signup card. This is the actual
 * conversion moment the homepage was previously missing entirely:
 * nothing before this pointed at Watchlist, Big Board, Team Sync, or
 * My Stuff at all, so there was no answer anywhere on the page to
 * "why would I make an account."
 */
export function AccountValue() {
  return (
    <section className="border-b border-border bg-void py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Make It Yours</span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            The rankings are public.
            <br />
            <span className="text-accent">Your setup isn&apos;t.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            An account is free and takes about ten seconds — here&apos;s what it actually unlocks.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {VALUE_ITEMS.map((item) => (
              <div key={item.title} className="flex items-start gap-4 py-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="font-headline text-lg uppercase leading-tight text-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center border border-accent/30 bg-accent/5 p-8">
            <p className="font-display text-xl font-semibold text-ink">Ready when you are.</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-tertiary">
              No credit card, no waiting period — just an email and a password.
            </p>
            <Button href="/signup" className="mt-6">
              Create your account
            </Button>
            <Link href="/login" className="mt-3 text-center text-xs text-ink-tertiary hover:text-ink hover:underline">
              Already have one? Log in
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
