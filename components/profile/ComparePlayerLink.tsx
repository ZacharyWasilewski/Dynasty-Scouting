"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
export function ComparePlayerLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
 const params = useSearchParams();
 return <Link href={`/compare?a=${encodeURIComponent(id)}&format=${encodeURIComponent(params.get("format") ?? "sf")}`} className={className}>{children}</Link>;
}
