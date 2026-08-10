import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";

export function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
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
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tightest text-ink sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
          {description}
        </p>
        <Badge tone="accent" className="mt-8">
          In development
        </Badge>
      </Container>
    </section>
  );
}
