import Link from "next/link";
import { Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { getProspects } from "@/lib/googleSheets";
import { getDDTier } from "@/lib/ddScore";
import { TIER_DEFINITIONS, getTierForScore } from "@/lib/tiers";

export const revalidate = 60;

export const metadata = {
  title: "Player Rankings — Dynasty Database",
};

export default async function PlayersPage() {
  const prospects = await getProspects();

  // Every prospect's tier, 1QB baseline — this is a fixed database-
  // wide structural summary, not a live tool with its own format
  // toggle, so a single consistent baseline (rather than trying to
  // sync with the rankings table's own toggle) is the honest choice
  // here, the same reasoning used for the Class page's equivalent
  // static-vs-live distinction.
  const tierCounts: Record<string, number> = {};
  for (const p of prospects) {
    const tier = p.hasDraftData === true ? getDDTier(p, "1QB") : getTierForScore(p.preDraftScore);
    if (tier) tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }
  const maxCount = Math.max(...TIER_DEFINITIONS.map((t) => tierCounts[t.name] ?? 0));
  const generationalCount = tierCounts["Generational"] ?? 0;

  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-8 py-8 sm:py-10 lg:flex-row lg:items-start lg:justify-between">
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
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Every graded prospect, ranked by Dynasty Database Score.
                {generationalCount > 0 && (
                  <>
                    {" "}Only{" "}
                    <Link href="/players?tier=Generational" className="font-semibold text-accent hover:underline">
                      {generationalCount} {generationalCount === 1 ? "has" : "have"} ever cleared a Generational grade
                    </Link>
                    {" "}— the rarest tier in the model.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* THE FULL HIERARCHY — every tier, database-wide, stacked
              top to bottom in the model's own order and narrowing
              (or not — this is the real shape of the actual data,
              not a forced pyramid) with the tier's real share of the
              database. A third distinct visual for the third
              ranking page: the Class page uses horizontal bars for a
              single class's composition, the Position page uses a
              10-square hit-rate array — this is neither; it's the
              database's own structural shape, top-heavy or not. */}
          {maxCount > 0 && (
            <div className="w-full shrink-0 lg:w-72">
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">
                The Full Hierarchy
              </span>
              <div className="mt-3 flex flex-col gap-1.5">
                {TIER_DEFINITIONS.map((tier) => {
                  const count = tierCounts[tier.name] ?? 0;
                  const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0;
                  return (
                    <Link
                      key={tier.name}
                      href={`/players?tier=${encodeURIComponent(tier.name)}`}
                      className="group flex items-center gap-2"
                    >
                      <span
                        className="h-4 transition-[width] duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: tier.color, minWidth: count > 0 ? "3px" : 0 }}
                      />
                      <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-ink-tertiary group-hover:text-ink">
                        {tier.name} ({count})
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <RankingsTable prospects={prospects} showClassColumn />
        </Container>
      </section>
    </main>
  );
}
