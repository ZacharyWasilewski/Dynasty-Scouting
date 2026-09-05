import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="py-10">
      <Container className="max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-40" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="mt-6 border border-border bg-surface">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-6" />
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
