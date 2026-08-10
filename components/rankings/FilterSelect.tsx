"use client";

import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function FilterSelect({ label, className, children, ...props }: FilterSelectProps) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <select
        {...props}
        className={cn(
          "appearance-none border border-border-strong bg-surface py-2 pl-3 pr-9 text-sm text-ink transition-colors duration-150 hover:border-border-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-tertiary" />
    </label>
  );
}
