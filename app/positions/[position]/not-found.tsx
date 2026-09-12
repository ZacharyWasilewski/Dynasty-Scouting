import { Users } from "@/components/ui/SiteIcons";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function PositionNotFound() {
  return (
    <main>
      <Container className="flex flex-col items-center py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface text-ink-tertiary">
          <Users className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tightest text-ink">
          Position not found
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          We currently track quarterbacks, running backs, wide receivers,
          and tight ends. This position group doesn&apos;t exist yet.
        </p>
        <div className="mt-8">
          <Button href="/players" variant="secondary">
            Back to rankings
          </Button>
        </div>
      </Container>
    </main>
  );
}
