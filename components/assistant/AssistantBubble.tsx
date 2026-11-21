"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { Mark, type MarkState } from "@/components/brand/Mark";

export function AssistantBubble({
  message,
  state = "idle",
  children,
  className,
  typewriter = true,
  compact,
}: {
  message: string;
  state?: MarkState;
  children?: ReactNode;
  className?: string;
  typewriter?: boolean;
  compact?: boolean;
}) {
  const { shown, done } = useTypewriter(message, 70, typewriter);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx("flex items-start gap-3", className)}>
      <Mark state={state} size={compact ? 32 : 40} className="shrink-0" />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 shadow-card">
        <p className={clsx("leading-relaxed text-ink", compact ? "text-sm" : "text-[15px]")} aria-live="polite">
          {shown}
          {!done && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-accent" />}
        </p>
        {done && children && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
