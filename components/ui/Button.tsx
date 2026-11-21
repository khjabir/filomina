"use client";

import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "brand-gradient-animated text-white glow-brand hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 shadow-card",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger-soft text-danger border border-danger/20 hover:border-danger/40",
  success: "bg-success-soft text-success border border-success/20 hover:border-success/40",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
  xl: "h-13 px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return clsx(base, variants[variant], sizes[size], extra);
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, icon, fullWidth, className, children, disabled, ...rest }: Props) {
  return (
    <button className={clsx(buttonClasses(variant, size), fullWidth && "w-full", className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
}) {
  return (
    <Link href={href} className={clsx(buttonClasses(variant, size), fullWidth && "w-full", className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
