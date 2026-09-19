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
              <Skeleton className="mt-2 h-9 w-32" />
              <Skeleton className="mt-3 h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-6 w-28 shrink-0" />
        </Container>
      </section>

      <section className="border-b border-border bg-void py-10">
        <Container>
          <div className="border border-border bg-surface p-6 sm:p-7">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
            <Skeleton className="mt-6 h-52 w-full" />
          </div>
        </Container>
      </section>

      <section className="bg-void py-10">
        <Container>
          <Skeleton className="h-96 w-full" />
        </Container>
      </section>
    </main>
  );
}
