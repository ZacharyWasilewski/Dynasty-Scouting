import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * CornerFrame — the signature visual motif for Dynasty Database.
 *
 * Four bracket marks at the corners of a panel, referencing the
 * targeting reticles scouts use when marking up film. Brackets sit
 * dim by default and brighten to accent gold on hover/focus, giving
 * cards a "locked on" feeling without any extra decoration.
 */
export function CornerFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const corner =
    "absolute h-3 w-3 border-border-strong transition-all duration-200 ease-out group-hover:border-accent group-hover:scale-125";

  return (
    <div
      className={cn(
        "group relative border border-border bg-surface p-6 transition-all duration-200 ease-out hover:bg-surface-raised hover:shadow-card-hover",
        className
      )}
    >
      <span className={cn(corner, "left-0 top-0 origin-top-left border-l-2 border-t-2")} />
      <span className={cn(corner, "right-0 top-0 origin-top-right border-r-2 border-t-2")} />
      <span className={cn(corner, "bottom-0 left-0 origin-bottom-left border-b-2 border-l-2")} />
      <span
        className={cn(corner, "bottom-0 right-0 origin-bottom-right border-b-2 border-r-2")}
      />
      {children}
    </div>
  );
}
