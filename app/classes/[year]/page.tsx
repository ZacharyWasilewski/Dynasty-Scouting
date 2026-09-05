import { notFound } from "next/navigation";
import { Layers } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ClassYearContent } from "@/components/classes/ClassYearContent";
import { getSheetData } from "@/lib/googleSheets";

// Class pages render dynamically from the canonical sheet snapshot; no build-time
// class roster is retained as a second, potentially stale source of truth.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { year: string } }) {
  return { title: `${params.year} Draft Class, Dynasty Database` };
}

export default async function ClassYearPage({ params }: { params: { year: string } }) {
  if (!/^\d{4}$/.test(params.year)) notFound();

  const { prospects: allProspects } = await getSheetData();
  const prospects = allProspects.filter((p) => p.draftClass === params.year);
  if (prospects.length === 0) notFound();

  const currentYear = new Date().getFullYear();
  const yearNumber = Number(params.year);
  const isEarlyWatch = yearNumber > currentYear + 1;
  const status = yearNumber > currentYear
    ? yearNumber === currentYear + 1 ? "Upcoming rookie class · evaluation in progress" : "Future class · early watch"
    : yearNumber === currentYear
      ? "Current rookie class · live board"
      : yearNumber === currentYear - 1
        ? "Year two · first NFL season complete"
        : `Historical class · ${currentYear - yearNumber} years of NFL context`;

  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-6 py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Layers className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
                {status}
              </span>
              <h1 className="mt-1 font-headline text-5xl leading-none text-ink sm:text-7xl">
                {params.year}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                {isEarlyWatch ? `Prospects currently being tracked for the ${params.year} class. Full Pre-Draft Scores and tiers will appear once enough college data is available for evaluation.` : `Every graded prospect from the ${params.year} class, with class strength and tier distribution evaluated at the appropriate stage of the model.`}
              </p>
            </div>
          </div>
          <Badge tone="accent" className="shrink-0 lg:mb-1">
            {prospects.length} prospects
          </Badge>
        </Container>
      </section>

      {/* The "Class at a Glance" summary (tier distribution, Elite+
          rate vs. the database average, highest graded prospect) now
          lives inside ClassYearContent, it has to be format-aware
          (recomputed live as the rankings table's own format toggle
          changes), which means it has to be a client component in
          sync with that table, not something the server can compute
          once and hand down as fixed numbers. */}
      <ClassYearContent prospects={prospects} allProspects={allProspects} earlyWatchMode={isEarlyWatch} />
    </main>
  );
}
