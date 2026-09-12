import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main>
      <section className="border-b border-border bg-grid-columns"><Container className="py-14 sm:py-20"><Skeleton className="h-10 w-10" /><Skeleton className="mt-6 h-3 w-36" /><Skeleton className="mt-3 h-12 w-80" /><Skeleton className="mt-4 h-4 w-full max-w-xl" /></Container></section>
      <section className="py-10"><Container><div className="grid gap-6 sm:grid-cols-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div><Skeleton className="mx-auto mt-12 h-80 w-full max-w-lg" /></Container></section>
    </main>
  );
}
