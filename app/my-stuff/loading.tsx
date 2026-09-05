import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main><section className="border-b border-border bg-grid-columns"><Container className="py-14 sm:py-20"><Skeleton className="h-10 w-10" /><Skeleton className="mt-6 h-3 w-24" /><Skeleton className="mt-3 h-12 w-64" /><Skeleton className="mt-4 h-4 w-full max-w-xl" /></Container></section><section className="py-10"><Container className="max-w-3xl"><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}</div></Container></section></main>
  );
}
