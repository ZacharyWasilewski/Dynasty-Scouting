import { Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { getProspects } from "@/lib/googleSheets";

export const metadata = {
  title: "Player Rankings — Dynasty Database",
};

export default async function PlayersPage() {
  const prospects = await getProspects();

  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                Big Board
              </span>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tightest text-ink sm:text-4xl">
                Prospect Rankings
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Every graded prospect, ranked and sortable by position,
                school, tier, and draft class.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <RankingsTable prospects={prospects} />
        </Container>
      </section>
    </main>
  );
}
