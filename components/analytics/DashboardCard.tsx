import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

export function DashboardCard({
  title,
  description,
  status,
  children,
  className,
}: {
  title: string;
  description?: string;
  status?: "live" | "pending";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`group border border-border bg-surface p-6 transition-all duration-200 ease-out hover:border-border-strong hover:shadow-card-hover sm:p-7 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          {description && (
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-tertiary">
              {description}
            </p>
          )}
        </div>
        {status && (
          <Badge tone={status === "live" ? "accent" : "neutral"} className="shrink-0">
            {status === "live" ? "Live" : "Awaiting data"}
          </Badge>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
