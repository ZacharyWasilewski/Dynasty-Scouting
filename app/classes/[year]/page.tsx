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
        <Container className="flex flex-col gap-6 py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          {/* Previous version split this into three separate small
              elements bolted onto the headline: a boxed icon chip, a
              tiny tracked-out mono-caps caption in accent blue, and a
              bordered accent "pill" badge off to the side for the
              prospect count — each on its own, a common generic-SaaS
              pattern (icon chip + eyebrow label + metric badge) that
              doesn't match the boldness of the site's actual display
              type. Rebuilt so one typeface — the same condensed
              display face already doing the heavy lifting on "2027"
              — carries the whole hero as a single composed moment:
              the status line is now a second line of that same
              headline face, not a foreign mono/caps/accent register,
              and it's quiet ink-secondary rather than accent blue
              since it's descriptive text, not a data value. The
              prospect count is folded into the sentence itself
              instead of sitting in its own bordered badge. */}
          <div>
            <p className="font-headline text-sm uppercase leading-none text-accent sm:text-base">
              {status}
            </p>
            <h1 className="mt-2 font-headline text-6xl leading-none text-ink sm:text-8xl">
              {params.year}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
              {isEarlyWatch
                ? `Prospects currently being tracked for the ${params.year} class. Full Pre-Draft Scores and tiers will appear once enough college data is available for evaluation.`
                : `Every graded prospect from the ${params.year} class — ${prospects.length} in all — with class strength and tier distribution evaluated at the appropriate stage of the model.`}
            </p>
          </div>
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
