import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main><section className="border-b border-border bg-grid-columns"><Container className="py-14 sm:py-20"><Skeleton className="h-10 w-10" /><Skeleton className="mt-6 h-3 w-24" /><Skeleton className="mt-3 h-12 w-72" /></Container></section><section className="py-10"><Container>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-3 h-24 w-full" />)}</Container></section></main>
  );
}
