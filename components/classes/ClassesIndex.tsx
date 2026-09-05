import Link from "next/link";
import { ArrowUpRight, Archive, Clock3, Layers, Sparkles } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import type { Prospect } from "@/types/prospect";
import { getTrackedClassYears } from "@/lib/classCycle";

function classMeta(year: string, count: number, currentYear: number) {
  const age = currentYear - Number(year);

  if (Number(year) > currentYear) {
    return {
      eyebrow: year === String(currentYear + 1) ? "Next rookie class" : "Future class",
      label: count > 0 ? "Evaluation in progress" : "Early watch",
      tone: "accent",
      icon: Sparkles,
    };
  }
  if (Number(year) === currentYear) {
    return { eyebrow: "Current rookie class", label: "Live class", tone: "ink", icon: Layers };
  }
  if (age === 1) return { eyebrow: "Year two", label: "First NFL season complete", tone: "muted", icon: Clock3 };
  if (age === 2) return { eyebrow: "Year three", label: "Career picture emerging", tone: "muted", icon: Clock3 };
  return { eyebrow: "Historical class", label: `${age} years of NFL context`, tone: "muted", icon: Archive };
}

export function ClassesIndex({ prospects }: { prospects: Prospect[] }) {
  const counts = new Map<string, number>();
  prospects.forEach((p) => {
    if (p.draftClass) counts.set(p.draftClass, (counts.get(p.draftClass) ?? 0) + 1);
  });

  const currentYear = new Date().getFullYear();
  const years = getTrackedClassYears(prospects).sort((a, b) => Number(b) - Number(a));
  // Keep the three featured cards intentionally fixed to the active draft window.
  // The full archive below remains completely data-driven, but these cards are the
  // product's primary entry points for the current rookie class and the next two classes.
  const featured = ["2026", "2027", "2028"];
  const archive = years.filter((y) => !featured.includes(y));
  const totalProspects = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return (
    <main className="bg-void">
      <section className="border-b border-border bg-surface">
        <Container className="py-12 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:items-end">
            <div>
              <div className="flex items-center gap-3 text-accent">
                <span className="flex h-10 w-10 items-center justify-center border border-accent/35 bg-accent/5">
                  <Layers className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="font-mono text-xs uppercase tracking-widest2">Draft Classes</span>
              </div>
              <h1 className="mt-5 max-w-3xl font-headline text-5xl uppercase leading-[0.88] tracking-tight text-ink sm:text-7xl lg:text-8xl">
                Follow the class.<br />Watch the story change.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
                Every class stays open from its first prospect evaluation through years of NFL results, so you can revisit what the model saw, what changed, and what it got right.
              </p>
            </div>

            <div className="border-l border-border pl-6 sm:pl-8 lg:pb-1">
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">The database timeline</span>
              <div className="mt-4 flex items-end gap-8">
                <div>
                  <div className="font-headline text-5xl leading-none text-ink">{years.length}</div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Classes tracked</div>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <div className="font-headline text-5xl leading-none text-ink">{totalProspects.toLocaleString()}</div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Graded prospects</div>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-secondary">
                Start with what is next, then move backward through the full archive.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-border bg-void">
        <Container className="py-10 sm:py-14">
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">Now in focus</span>
              <h2 className="mt-2 font-headline text-3xl uppercase tracking-tight text-ink sm:text-4xl">The classes that matter right now.</h2>
            </div>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary sm:block">Live evaluation timeline</span>
          </div>

          <div className="mt-8 grid gap-px border border-border bg-border lg:grid-cols-3">
            {featured.map((year, index) => {
              const count = counts.get(year) ?? 0;
              const meta = classMeta(year, count, currentYear);
              const Icon = meta.icon;
              return (
                <Link
                  key={year}
                  href={`/classes/${year}`}
                  prefetch={false}
                  className={`group relative bg-surface p-5 transition-colors duration-200 hover:bg-void sm:p-6 lg:min-h-[260px] lg:p-8 ${index === 1 ? "lg:min-h-[320px]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">{meta.eyebrow}</span>
                    <Icon className={`h-4 w-4 ${meta.tone === "accent" ? "text-accent" : "text-ink-tertiary"}`} strokeWidth={1.7} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-4 lg:mt-8">
                    <span className={`font-headline leading-none text-5xl tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl ${index === 1 ? "text-accent" : "text-ink"}`}>{year}</span>
                    <ArrowUpRight className="mb-2 h-5 w-5 text-ink-tertiary transition-all duration-200 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
                  </div>
                  <div className="mt-3 border-t border-border pt-3 lg:mt-8 lg:pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-ink">{count > 0 ? `${count} prospects` : "Early look"}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">{meta.label}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-tertiary">The full archive</span>
              <h2 className="mt-3 font-headline text-3xl uppercase leading-[0.95] tracking-tight text-ink">Every board.<br />Every era.</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
                Go back to see how a class was graded, ranked, and ultimately measured against the rest of the database.
              </p>
            </div>

            <div className="border-t border-border">
              {archive.map((year) => {
                const count = counts.get(year) ?? 0;
                const meta = classMeta(year, count, currentYear);
                return (
                  <Link
                    key={year}
                    href={`/classes/${year}`}
                    prefetch={false}
                    className="group grid grid-cols-[minmax(86px,0.4fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-5 sm:grid-cols-[150px_minmax(0,1fr)_120px_auto] sm:gap-6"
                  >
                    <span className="font-headline text-3xl text-ink transition-colors group-hover:text-accent sm:text-4xl">{year}</span>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest2 text-ink-secondary">{meta.eyebrow}</div>
                      <div className="mt-1 text-xs text-ink-tertiary sm:text-sm">{meta.label}</div>
                    </div>
                    <span className="hidden font-mono text-[11px] text-ink-tertiary sm:block">{count > 0 ? `${count} prospects` : "Early look"}</span>
                    <ArrowUpRight className="h-4 w-4 text-ink-tertiary transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                );
              })}
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
