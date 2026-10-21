import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col gap-8 py-14 sm:flex-row sm:items-end sm:justify-between lg:py-20">
          <div className="flex items-start gap-5">
            <Skeleton className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
            <div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-10 w-56" />
              <Skeleton className="mt-3 h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-8 w-40" />
        </Container>
      </section>

      <section className="border-b border-border bg-void py-14">
        <Container>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface p-6">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-8 w-16" />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-void py-14">
        <Container>
          <Skeleton className="h-64 w-full" />
        </Container>
      </section>
    </main>
  );
}
