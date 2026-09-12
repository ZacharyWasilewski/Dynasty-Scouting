"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "@/components/ui/SiteIcons";
import { cn } from "@/lib/utils";

/**
 * Wraps a chunk of existing content in a collapsible section on
 * mobile only. On sm+ screens the wrapper renders as `display:
 * contents` — it disappears from the box model entirely so the
 * desktop layout (existing headers, grids, spacing) is completely
 * unaffected — and the content is always shown, ignoring open/closed
 * state.
 *
 * This is presentation-only: it never removes, unmounts, or alters
 * the children, so nothing about the underlying content is affected
 * — only whether it's visible on small screens. Originally built for
 * the Analytics page; reused as-is (not reimplemented) anywhere else
 * on the site that needs the same "collapsed by default on mobile,
 * always expanded on desktop" behavior — currently Analytics and
 * Team Sync's results page.
 */
export function MobileAccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="sm:contents">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 text-left active:bg-surface-raised sm:hidden"
      >
        <span className="font-display text-sm font-semibold text-ink">{title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-ink-tertiary transition-transform duration-200",
            open && "rotate-180"
          )}
          strokeWidth={2}
        />
      </button>
      <div
        id={contentId}
        className={cn(open ? "block" : "hidden", "sm:!block")}
      >
        {children}
      </div>
    </div>
  );
}
