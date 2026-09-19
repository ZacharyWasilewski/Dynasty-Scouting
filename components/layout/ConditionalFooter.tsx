"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";

export function ConditionalFooter({ lastDataRefresh }: { lastDataRefresh: string | null }) {
  const pathname = usePathname();
  if (pathname === "/mock-draft" || pathname.startsWith("/mock-draft/")) return null;
  return <Footer lastDataRefresh={lastDataRefresh} />;
}
