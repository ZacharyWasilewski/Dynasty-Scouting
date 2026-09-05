import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeTone = "accent" | "neutral" | "outline";

const toneStyles: Record<BadgeTone, string> = {
  accent: "bg-accent/10 text-accent border border-accent/30",
  neutral: "bg-surface-raised text-ink-secondary border border-border",
  outline: "bg-transparent text-ink-tertiary border border-border",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-widest2",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
