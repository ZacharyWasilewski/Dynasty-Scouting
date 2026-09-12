import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col items-start py-20 lg:py-24">
          <Skeleton className="h-12 w-12" />
          <Skeleton className="mt-6 h-3 w-24" />
          <Skeleton className="mt-3 h-11 w-80" />
          <Skeleton className="mt-4 h-4 w-96" />
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
