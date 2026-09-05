import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="py-10"><Container><Skeleton className="h-3 w-16" /><Skeleton className="mt-3 h-12 w-56" /><Skeleton className="mt-4 h-4 w-full max-w-2xl" /><div className="mt-8 max-w-3xl"><Skeleton className="h-52 w-full" /></div></Container></main>
  );
}
