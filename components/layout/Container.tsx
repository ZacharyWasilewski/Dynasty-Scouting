import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// 1600px, not the more common max-w-7xl (1280px) — on genuinely wide
// monitors, 1280px left large, consistent empty margins on both sides
// of every page (navbar included, since it uses this same component),
// reported directly from a real full-screen browser screenshot rather
// than assumed. Still capped, not full-bleed — an analytics site's
// content shouldn't stretch edge-to-edge on an ultrawide display
// either, this just uses meaningfully more of a normal wide screen
// than the previous cap did.
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
