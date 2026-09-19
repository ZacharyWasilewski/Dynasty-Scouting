import { ArrowUpRight, ClipboardList, Link2 } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";

const TOOLS = [
  {
    icon: ClipboardList,
    number: "01",
    label: "Mock Draft",
    description: "Run a full mock against real AI-driven opponents and make picks against the live board.",
    href: "/mock-draft",
  },
  {
    icon: Link2,
    number: "02",
    label: "Team Sync",
    description: "Bring in your Sleeper roster so draft recommendations can account for what your team actually needs.",
    href: "/team-sync",
  },
];

/**
 * The decision layer of the homepage. This deliberately answers a different
 * question from ProductShowcase: not "what can I research?", but "what can
 * I do when the clock is actually running?"
 *
 * Player Comparison intentionally isn't listed here even though it's a
 * real in-draft decision tool: TryComparison, right below this section,
 * already embeds that exact tool live rather than just linking to it —
 * advertising it a second time here as a static card was pure repetition
 * of the section immediately after it.
 */
export function ToolsShowcase() {
  return (
    <section className="border-y border-border bg-void py-12 sm:py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div className="max-w-xl">
            <span className="font-headline text-sm uppercase text-accent">
              Draft tools
            </span>
            <h2 className="mt-3 font-headline text-4xl uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
              Turn research
              <br />
              into a decision.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-ink-secondary lg:pb-1">
            The database gets you to the board. These tools are built for the moment you actually have to make the pick.
          </p>
        </div>

        <div className="mt-12 grid border border-border md:grid-cols-2">
          {TOOLS.map((tool, i) => (
            <a
              key={tool.label}
              href={tool.href}
              className={`group flex min-h-[250px] flex-col p-6 transition-colors duration-200 hover:bg-surface sm:p-8 ${
                i > 0 ? "border-t border-border md:border-l md:border-t-0" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-data text-xs text-accent">{tool.number}</span>
                <tool.icon className="h-5 w-5 text-ink-tertiary transition-colors duration-200 group-hover:text-accent" strokeWidth={1.5} />
              </div>
              <div className="mt-auto pt-10">
                <span className="font-headline text-2xl uppercase leading-tight text-ink sm:text-3xl">
                  {tool.label}
                </span>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{tool.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[10px] text-ink-tertiary transition-colors duration-200 group-hover:text-accent">
                  Open tool <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
