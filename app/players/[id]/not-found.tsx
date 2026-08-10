import Link from "next/link";
import { UserX } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function ProspectNotFound() {
  return (
    <main>
      <Container className="flex flex-col items-center py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-border-strong bg-surface text-ink-tertiary">
          <UserX className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tightest text-ink">
          Profile not available
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          This prospect hasn&apos;t been graded yet, or the profile doesn&apos;t
          exist. Full scouting reports go live as grading is completed.
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
