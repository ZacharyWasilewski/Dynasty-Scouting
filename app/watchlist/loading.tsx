import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns">
        <Container className="flex flex-col items-start py-20 lg:py-24">
          <Skeleton className="h-12 w-12" />
          <Skeleton className="mt-6 h-3 w-20" />
          <Skeleton className="mt-3 h-11 w-56" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <div className="overflow-hidden border border-border">
            <Skeleton className="h-11 w-full" />
            {Array.from({ length: 4 }).map((_, i) => (
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
