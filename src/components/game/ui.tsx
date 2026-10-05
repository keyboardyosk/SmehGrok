import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "quiet";
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-11 rounded-sm px-4 text-sm font-medium tracking-wide transition-opacity duration-150 ease-out enabled:active:scale-[0.98] disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "ghost" && "border border-border bg-bg-elevated text-fg",
        variant === "quiet" && "bg-bg-subtle text-fg",
        variant === "danger" && "bg-danger text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-elevated/95 shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "ok" | "warn" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-sm px-2 font-mono text-[11px] tracking-wider uppercase",
        tone === "muted" && "bg-bg-subtle text-muted",
        tone === "ok" && "bg-ok/20 text-fg",
        tone === "warn" && "bg-warn/20 text-fg",
        tone === "danger" && "bg-danger/25 text-fg",
      )}
    >
      {children}
    </span>
  );
}
