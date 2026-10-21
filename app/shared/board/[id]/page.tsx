import { notFound } from "next/navigation";
import Link from "next/link";
import { ListOrdered } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { TierBadge } from "@/components/rankings/TierBadge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getTierColor } from "@/lib/tiers";
import { getDDScore, getDDTier } from "@/lib/ddScore";
import { query } from "@/lib/db";
import { getProspects } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

async function getSharedBoard(id: string) {
  const rows = await query<{ class_year: string; prospect_ids: string[] }>(
    `SELECT class_year, prospect_ids FROM shared_boards WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const board = await getSharedBoard(params.id);
  return { title: board ? `${board.class_year} Big Board, Dynasty Database` : "Big Board, Dynasty Database" };
}

export default async function SharedBoardPage({ params }: { params: { id: string } }) {
  const board = await getSharedBoard(params.id);
  if (!board) notFound();

  const allProspects = await getProspects();
  const byId = new Map(allProspects.map((p) => [p.id, p]));
  // Live prospect data (name, score, tier) joined against the frozen
  // ORDER from the moment this was shared — see the table comment in
  // lib/db.ts for why only the order is snapshotted. A prospect that
  // no longer exists in the live dataset (extremely unlikely, but not
  // impossible over a long enough time) is just skipped rather than
  // breaking the whole page.
  const ranked = board.prospect_ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <main>
      <SectionIntro
        icon={ListOrdered}
        eyebrow={`${board.class_year} Big Board`}
        title="Someone's personal ranking"
        description="A shared, read-only snapshot of someone's board. Scores and tiers reflect the live model, while the player order stays exactly as they left it."
      />
      <section className="py-10">
        <Container className="max-w-2xl">
          <div className="border border-border bg-surface">
            {ranked.map((p, i) => {
              const format: "1QB" | "SUPERFLEX" = "SUPERFLEX";
              const tier = getDDTier(p, format);
              const score = getDDScore(p, format);
              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  prefetch={false}
                  className="flex items-center gap-3 border-t border-border px-4 py-3 transition-colors duration-150 first:border-t-0 hover:bg-surface-raised active:bg-surface-raised"
                >
                  <span className="w-7 shrink-0 text-center font-data text-xs text-ink-tertiary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-tertiary">
                      {p.position}
                      {p.school && (
                        <>
                          · <SchoolLogo url={p.schoolLogoUrl} size={12} /> {p.school}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-sm font-semibold"
                    style={{ color: tier ? getTierColor(tier) : undefined }}
                  >
                    {score?.toFixed(1) ?? "—"}
                  </span>
                  {tier && <TierBadge tier={tier} perfectScore={score === 100} />}
                </Link>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-ink-tertiary">
            Want to build your own?{" "}
            <Link href="/board" className="text-accent hover:underline">
              Start a Big Board
            </Link>
          </p>
        </Container>
      </section>
    </main>
  );
}
