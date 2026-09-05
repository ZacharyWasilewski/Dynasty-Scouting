import type { LucideIcon } from "@/components/ui/SiteIcons";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";

export function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  variant = "editorial",
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
  /** Utility intros are intentionally more compact than editorial pages so
   * personal tools don't all inherit the same oversized landing-page header. */
  variant?: "editorial" | "utility";
}) {
  const utility = variant === "utility";
  return (
    <section className="border-b border-border bg-grid-columns">
      <Container className={utility ? "py-9 sm:py-11" : "flex flex-col items-start py-20 lg:py-24"}>
        {utility ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent/35 bg-surface text-accent">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-accent">{eyebrow}</span>
              <h1 className="mt-2 font-headline text-3xl uppercase leading-[0.95] tracking-tight text-ink sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">{description}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
          </div>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="mt-6 font-mono text-xs uppercase tracking-widest2 text-accent">{eyebrow}</span>
            <h1 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl">{title}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">{description}</p>
            {children && <div className="mt-4">{children}</div>}
          </>
        )}
      </Container>
    </section>
  );
}
