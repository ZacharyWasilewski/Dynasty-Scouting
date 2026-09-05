import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="py-10">
      <Container className="max-w-2xl">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />

        <div className="mt-6 border border-border bg-surface">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3 last:border-0">
              <Skeleton className="h-3 w-24" />
              <div className="mt-2 flex items-center gap-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
