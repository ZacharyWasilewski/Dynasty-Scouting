import { Info } from "@/components/ui/SiteIcons";
import { SectionIntro } from "@/components/layout/SectionIntro";
import { Container } from "@/components/layout/Container";
import { getProspects } from "@/lib/googleSheets";
import { overallStats } from "@/lib/analytics";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AboutPage() {
  const prospects = await getProspects();
  const stats = overallStats(prospects);
  return (
    <main>
      <SectionIntro icon={Info} eyebrow="About" title="Analytical grades, built for dynasty." description="Dynasty Database is an independent dynasty prospect evaluation and historical research platform. It grades prospects, preserves those evaluations, and compares them with what happened next." />
      <section className="border-b border-border bg-void py-16">
        <Container>
          <div className="max-w-3xl">
            <h2 className="font-display text-2xl font-semibold tracking-tightest text-ink">What Dynasty Database is</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">Most dynasty rankings tell you where a player ranks. Dynasty Database is built around a different question: <span className="font-semibold text-ink">why does this prospect rank here, and how did similar evaluations turn out?</span></p>
            <p className="mt-4 text-sm leading-relaxed text-ink-tertiary">The project combines position-specific prospect metrics, pre-draft evaluation, draft context, opportunity, tier-based historical outcomes, player-level profiles, and rookie draft projections. The same database keeps successful evaluations and misses so the model can be evaluated rather than simply asserted to work.</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {[
              { value: String(stats.total), label: "Prospects tracked" },
              { value: String(stats.scored), label: "Prospects scored" },
              { value: String(stats.classesTracked), label: "Draft classes" },
              { value: "4", label: "Position models" },
            ].map(item => <div key={item.label} className="bg-surface p-5 text-center sm:p-7"><p className="font-headline text-4xl leading-none text-ink sm:text-5xl">{item.value}</p><p className="mt-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">{item.label}</p></div>)}
          </div>
        </Container>
      </section>
      <section className="border-b border-border py-16">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div><p className="font-mono text-xs uppercase tracking-widest2 text-accent">The philosophy</p><h2 className="mt-2 font-display text-2xl font-semibold text-ink">Judge prospects with the information available at the time.</h2><p className="mt-4 text-sm leading-relaxed text-ink-secondary">Pre-draft scores are meant to answer a pre-draft question. Once the NFL Draft happens, draft capital becomes known; once a player earns an NFL role, opportunity becomes known. Keeping those stages distinct helps avoid using hindsight to grade an earlier evaluation.</p></div>
          <div><p className="font-mono text-xs uppercase tracking-widest2 text-accent">What gets measured</p><div className="mt-3 divide-y divide-border border border-border bg-surface">{["Position-specific prospect signals","Pre-draft and opportunity-independent scores","Draft capital and qualitative opportunity","Historical hit/miss outcomes and tier performance","Player-level comparisons, historical comps, and draft projections"].map(x=><div key={x} className="px-4 py-3 text-sm text-ink-secondary">{x}</div>)}</div></div>
        </Container>
      </section>
      <section className="py-16"><Container className="max-w-3xl"><div className="border border-border-strong bg-surface p-6 sm:p-8"><p className="font-mono text-xs uppercase tracking-widest2 text-accent">Model accountability</p><h2 className="mt-2 font-display text-2xl font-semibold text-ink">The database keeps the good calls and the bad ones.</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">Historical outcomes are part of the product, not a marketing appendix. That makes it possible to inspect tier hit rates, model-versus-capital results, calibration, and individual successes and failures over time.</p><Link href="/methodology" className="mt-5 inline-block font-mono text-xs uppercase tracking-widest2 text-accent hover:underline">Read the full methodology →</Link></div></Container></section>
    </main>
  );
}
