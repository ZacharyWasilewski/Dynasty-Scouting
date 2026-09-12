import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] w-full bg-void py-12">
      <Container className="max-w-2xl">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />

        <div className="mt-8 space-y-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Container>
    </main>
  );
}
