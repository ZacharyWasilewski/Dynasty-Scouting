import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start lg:px-8 lg:py-16">
          <Skeleton className="h-40 w-40 shrink-0 sm:h-48 sm:w-48" />
          <div className="flex-1">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="mt-4 h-11 w-72" />
            <Skeleton className="mt-3 h-4 w-48" />
            <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="mt-2 h-5 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-14">
        <Container>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="mx-auto h-32 w-32 rounded-full" />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-b border-border bg-void py-14">
        <Container>
          <Skeleton className="mx-auto h-72 w-72" />
        </Container>
      </section>
    </main>
  );
}
