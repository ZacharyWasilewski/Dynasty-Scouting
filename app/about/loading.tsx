import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns"><Container className="py-14 sm:py-20"><Skeleton className="h-10 w-10" /><Skeleton className="mt-6 h-3 w-16" /><Skeleton className="mt-3 h-12 w-96" /><Skeleton className="mt-4 h-4 w-full max-w-xl" /></Container></section>
      <section className="py-16"><Container><Skeleton className="h-24 w-full max-w-2xl" /><div className="mt-12 grid grid-cols-2 gap-px sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div></Container></section>
    </main>
  );
}
