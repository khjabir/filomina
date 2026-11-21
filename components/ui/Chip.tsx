import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export function Chip({ className, children, tone = "default", ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "accent" | "success" | "warning" | "danger" }) {
  const tones = {
    default: "bg-surface-2 text-muted border-line",
    accent: "bg-accent-soft text-accent border-accent/20",
    success: "bg-success-soft text-success border-success/20",
    warning: "bg-warning-soft text-warning border-warning/20",
    danger: "bg-danger-soft text-danger border-danger/20",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}
