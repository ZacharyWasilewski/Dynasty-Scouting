import { Layers } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function ClassYearNotFound() {
  return (
    <main>
      <Container className="flex flex-col items-center py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface text-ink-tertiary">
          <Layers className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tightest text-ink">
          Class not found
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          This draft class doesn&apos;t have any graded prospects, or the
          year doesn&apos;t exist.
        </p>
        <div className="mt-8">
          <Button href="/classes" variant="secondary">
            Back to classes
          </Button>
        </div>
      </Container>
    </main>
  );
}
