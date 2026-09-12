import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-1 h-9 w-9 shrink-0" />
            <div>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-9 w-40" />
              <Skeleton className="mt-3 h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-6 w-36" />
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface p-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-16" />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-border bg-void py-10">
        <Container>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border bg-surface p-7">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-3 w-64" />
                <Skeleton className="mt-6 h-48 w-full" />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
