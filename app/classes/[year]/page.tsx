import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
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
        <Container className="py-4 sm:py-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-headline text-4xl leading-none text-ink sm:text-5xl">{params.year}</h1>
            <p className="font-headline text-sm uppercase leading-none text-accent sm:text-base">{status}</p>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-secondary sm:text-sm">
            {isEarlyWatch
              ? `Prospects currently being tracked for the ${params.year} class. Full Pre-Draft Scores and tiers will appear once enough college data is available.`
              : `${prospects.length} graded prospects, scored at the appropriate stage of the model.`}
          </p>
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
