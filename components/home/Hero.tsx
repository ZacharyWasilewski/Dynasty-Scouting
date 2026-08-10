import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { SearchBar } from "@/components/home/SearchBar";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-grid-columns bg-radial-vignette">
      <Container className="relative flex flex-col items-start py-20 lg:py-28">
        <Badge tone="outline" className="animate-fade-in-up [animation-delay:0ms]">
          2027 Draft Cycle · In Progress
        </Badge>

        <h1 className="mt-6 animate-fade-in-up font-display text-5xl font-semibold leading-[1.02] tracking-tightest text-ink text-balance [animation-delay:80ms] sm:text-6xl lg:text-[5.5rem]">
          Dynasty
          <br />
          <span className="text-accent">Database</span>
        </h1>

        <p className="mt-6 max-w-xl animate-fade-in-up text-lg leading-relaxed text-ink-secondary [animation-delay:160ms]">
          Analytical grades, position rankings, and draft-class boards for
          every incoming dynasty relevant rookie since 2015.
        </p>

        <div className="mt-10 w-full animate-fade-in-up [animation-delay:240ms]">
          <SearchBar />
        </div>
      </Container>
    </section>
  );
}
