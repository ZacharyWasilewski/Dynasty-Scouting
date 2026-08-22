import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";

export function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  /** Optional extra content rendered right after the description,
   *  inside the same padded intro block (e.g. a cross-link to a
   *  related feature) — avoids callers having to fight this
   *  section's own top/bottom padding with margin hacks. */
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-grid-columns">
      <Container className="flex flex-col items-start py-20 lg:py-24">
        <span className="flex h-12 w-12 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="mt-6 font-mono text-xs uppercase tracking-widest2 text-accent">
          {eyebrow}
        </span>
        <h1 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
          {description}
        </p>
        {children && <div className="mt-4">{children}</div>}
      </Container>
    </section>
  );
}
