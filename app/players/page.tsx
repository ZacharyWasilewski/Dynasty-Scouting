import { Users } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { RankingsPageContent } from "@/components/rankings/RankingsPageContent";
import { getProspects } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Player Rankings, Dynasty Database",
};

export default async function PlayersPage() {
  const prospects = await getProspects();

  return (
    <main>
      <section className="bg-surface">
        <Container className="pt-8 sm:pt-10">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                Big Board
              </span>
              <h1 className="mt-1 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
                Prospect Rankings
              </h1>
            </div>
          </div>
        </Container>
      </section>

      {/* Everything below the title is format-dependent (the tier
          hierarchy chart and the rankings table itself), which means
          it has to live in a client component that owns the shared
          format state, see RankingsPageContent's own comment for
          the two real bugs this fixes (a static chart that never
          matched the live table below it, and devy prospects
          silently corrupting a chart meant to represent DD Score
          tiers specifically). */}
      <RankingsPageContent prospects={prospects} />
    </main>
  );
}
