import { ArrowUpRight, ClipboardList, GitCompareArrows, Link2 } from "lucide-react";
import { Container } from "@/components/layout/Container";

const TOOLS = [
  {
    icon: ClipboardList,
    label: "Mock Draft",
    description: "Run a full mock against real AI-driven opponents, DD Score or Community Rankings.",
    href: "/mock-draft",
  },
  {
    icon: GitCompareArrows,
    label: "Player Comparison",
    description: "Put any two prospects side by side — subscores, tiers, and career trajectory.",
    href: "/compare",
  },
  {
    icon: Link2,
    label: "Team Sync",
    description: "Link your Sleeper league and get draft recommendations based on your actual roster needs.",
    href: "/team-sync",
  },
];

/**
 * A numbered index, not a row of icon cards — echoes the ranked
 * numerals used elsewhere on the page (the class spotlight, the
 * hero) without repeating their structure, so it reads as the same
 * visual family without being another copy of the same card shape.
 */
export function ToolsShowcase() {
  return (
    <section className="border-b border-border bg-void py-24">
      <Container>
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
            Beyond the Rankings
          </span>
          <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            Tools built for
            <br />
            actually drafting.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-secondary">
            The rankings are the foundation — these are for when you&apos;re getting ready to pick.
          </p>
        </div>

        <div className="mt-14 flex flex-col divide-y divide-border border-y border-border">
          {TOOLS.map((tool, i) => (
            <a
              key={tool.label}
              href={tool.href}
              className="group flex items-center gap-4 py-6 transition-colors duration-200 hover:bg-surface sm:gap-8 sm:py-8"
            >
              <span className="w-12 shrink-0 font-headline text-4xl leading-none text-border-strong transition-colors duration-200 group-hover:text-accent sm:w-16 sm:text-6xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <tool.icon className="hidden h-5 w-5 shrink-0 text-accent sm:block sm:h-6 sm:w-6" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <span className="font-headline text-xl uppercase leading-tight text-ink sm:text-2xl">
                  {tool.label}
                </span>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-secondary">{tool.description}</p>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-tertiary transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
