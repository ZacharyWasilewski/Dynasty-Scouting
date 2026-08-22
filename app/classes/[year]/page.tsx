import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ClassYearContent } from "@/components/classes/ClassYearContent";
import { getSheetData } from "@/lib/googleSheets";

// Every class year page is pre-built at deploy time, then quietly
// refreshed in the background every 60 seconds — matches the data
// layer's own cache window, so nobody ever waits on a live fetch.
export const revalidate = 60;

export async function generateStaticParams() {
  const { prospects } = await getSheetData();
  const years = new Set(prospects.map((p) => p.draftClass).filter((y): y is string => Boolean(y)));
  return [...years].map((year) => ({ year }));
}

export async function generateMetadata({ params }: { params: { year: string } }) {
  return { title: `${params.year} Draft Class — Dynasty Database` };
}

export default async function ClassYearPage({ params }: { params: { year: string } }) {
  if (!/^\d{4}$/.test(params.year)) notFound();

  const { prospects: allProspects } = await getSheetData();
  const prospects = allProspects.filter((p) => p.draftClass === params.year);
  if (prospects.length === 0) notFound();

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
                Draft Class
              </span>
              <h1 className="mt-1 font-headline text-5xl leading-none text-ink sm:text-7xl">
                {params.year}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-secondary">
                Every graded prospect from the {params.year} class, ranked
                and sortable by position, school, and tier.
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
          lives inside ClassYearContent — it has to be format-aware
          (recomputed live as the rankings table's own format toggle
          changes), which means it has to be a client component in
          sync with that table, not something the server can compute
          once and hand down as fixed numbers. */}
      <ClassYearContent prospects={prospects} allProspects={allProspects} />
    </main>
  );
}
