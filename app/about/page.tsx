import { Info } from "lucide-react";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { Container } from "@/components/layout/Container";
import { getProspects } from "@/lib/googleSheets";
import { overallStats } from "@/lib/analytics";

export const revalidate = 60;

export default async function AboutPage() {
  const prospects = await getProspects();
  const stats = overallStats(prospects);

  return (
    <main>
      <SectionIntro
        icon={Info}
        eyebrow="About"
        title="Analytical grades, built for dynasty."
        description="Dynasty Database is an independent dynasty rookie analytics project, grading every incoming dynasty relevant rookie since 2015 with a consistent, data-driven model."
      />

      {/* One person, real numbers — no invented company narrative
          here, just what's actually true and can actually be
          checked: built solo, and here's the real scale of what
          that's produced. The stats reuse the exact same computation
          the homepage's track record uses, not separate marketing
          figures. */}
      <section className="border-b border-border bg-void py-16">
        <Container>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary">
            Built and maintained by one person — a dynasty player who wanted a grading system that actually holds
            up against what happens next.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {[
              { value: String(stats.total), label: "Prospects Graded" },
              { value: String(stats.classesTracked), label: "Draft Classes" },
              { value: "8", label: "Grading Tiers" },
              { value: "4", label: "Position-Specific Models" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center justify-center bg-surface p-6 text-center sm:p-8">
                <p className="font-headline text-5xl leading-none text-ink sm:text-6xl">{item.value}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">{item.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
