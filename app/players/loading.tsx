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
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-9 w-64" />
              <Skeleton className="mt-3 h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-6 w-32" />
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          <Skeleton className="mt-4 h-3 w-40" />

          <div className="mt-3 overflow-hidden border border-border">
            <Skeleton className="h-11 w-full" />
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-border px-4 py-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-10" />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
