import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col items-start py-20 lg:py-28">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-14 w-full max-w-xl" />
          <Skeleton className="mt-4 h-4 w-full max-w-md" />
          <Skeleton className="mt-8 h-11 w-40" />
        </Container>
      </section>

      <section className="border-b border-border bg-void py-10">
        <Container>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
