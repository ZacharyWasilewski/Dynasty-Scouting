import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Optional so a genuinely conditional case (e.g. two entirely
   *  different messages depending on whether a filter is active) can
   *  skip this and supply its own text via children instead, rather
   *  than being forced through one fixed title. */
  title?: string;
  description?: string;
  /** Rendered as a real Button — for a login prompt or similar primary
   *  action. Using an actual button rather than a text link matters
   *  here specifically: this same "Log in to continue" action used to
   *  be styled two different ways across sibling pages (a prominent
   *  Button on some, a subdued text link on others) for the identical
   *  purpose, which is exactly the kind of inconsistency a shared
   *  component is meant to prevent. */
  action?: { label: string; href: string };
  /** Escape hatch for a genuinely different situation — e.g.
   *  PositionExplorer's "no results" state, where the action is
   *  "clear filters" (not navigation) and needs the current position's
   *  own theme color rather than the site accent. */
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 border border-border bg-surface px-6 py-16 text-center",
        className
      )}
    >
      <Icon className="h-6 w-6 text-ink-tertiary" strokeWidth={1.5} />
      {title && <p className="text-sm font-medium text-ink-secondary">{title}</p>}
      {description && <p className="max-w-xs text-xs leading-relaxed text-ink-tertiary">{description}</p>}
      {action && (
        <Button href={action.href} className="mt-2">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
