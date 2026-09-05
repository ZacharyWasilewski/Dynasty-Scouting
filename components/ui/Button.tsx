import { cn } from "@/lib/utils";
import Link from "next/link";
import { Loader2 } from "@/components/ui/SiteIcons";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  onClick?: never;
}

interface ButtonAsButton extends ButtonBaseProps {
  href?: never;
  onClick?: () => void;
  type?: "button" | "submit";
}

type ButtonProps = ButtonAsLink | ButtonAsButton;

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-void hover:bg-accent-soft active:bg-accent-dim",
  secondary:
    "bg-surface text-ink border border-border-strong hover:border-accent/50 hover:text-accent hover:bg-surface-raised",
  ghost: "text-ink-secondary hover:text-ink hover:bg-surface/60",
};

const baseStyles =
  "relative inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]";

export function Button(props: ButtonProps) {
  const { variant = "primary", children, className, loading, disabled } = props;
  const classes = cn(baseStyles, variantStyles[variant], className);
  const isDisabled = disabled || loading;

  const content = (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-opacity duration-150",
          loading && "opacity-0"
        )}
      >
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
    </>
  );

  if ("href" in props && props.href) {
    if (isDisabled) {
      return (
        <span className={cn(classes, "opacity-40 pointer-events-none")} aria-disabled>
          {content}
        </span>
      );
    }
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }

  const { onClick, type = "button" } = props as ButtonAsButton;
  return (
    <button type={type} onClick={onClick} disabled={isDisabled} className={classes}>
      {content}
    </button>
  );
}
