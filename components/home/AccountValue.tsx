import Link from "next/link";
import { ArrowRight, Bookmark, LayoutGrid, ListOrdered } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

const VALUE_ITEMS = [
  {
    icon: Bookmark,
    number: "01",
    title: "Watchlist",
    description: "Keep the prospects you are tracking in one place and see what changed when you come back.",
    href: "/watchlist",
  },
  {
    icon: ListOrdered,
    number: "02",
    title: "Your Big Board",
    description: "Start from the model, then reorder the class into the board you actually want to draft from.",
    href: "/board",
  },
  {
    icon: LayoutGrid,
    number: "03",
    title: "My Stuff",
    description: "One personal home for saved players, boards, and the work you have already done.",
    href: "/my-stuff",
  },
];

/**
 * The ownership layer. Team Sync lives in the draft-tools section so it is not
 * advertised twice; this section is only about the workspace that belongs to
 * the user and gives the homepage a clearly different conversion moment.
 */
export function AccountValue() {
  return (
    <section className="border-b border-border bg-void py-24">
      <Container>
        <div className="border border-border bg-surface">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-border p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">Your workspace</span>
              <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
                The rankings are public.
                <br />
                <span className="text-accent">The work is yours.</span>
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-secondary">
                Save the players, shape your board, and come back without losing the research you already did.
              </p>

              <div className="mt-8 border-t border-border pt-6">
                <p className="font-display text-lg font-semibold text-ink">Ready when you are.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-tertiary">Free to create. No credit card or waiting period.</p>
                <Button href="/signup" className="mt-5 w-full sm:w-auto">Create your account</Button>
                <Link href="/login" className="mt-3 block text-xs text-ink-tertiary hover:text-ink hover:underline">
                  Already have one? Log in
                </Link>
              </div>
            </div>

            <div className="divide-y divide-border">
              {VALUE_ITEMS.map((item) => (
                <Link key={item.title} href={item.href} prefetch={false} className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-4 p-6 transition-colors hover:bg-void sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:p-8">
                  <div className="pt-0.5">
                    <span className="font-data text-xs text-accent">{item.number}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
                      <p className="font-headline text-xl uppercase leading-tight text-ink">{item.title}</p>
                    </div>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">{item.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-ink-tertiary transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
