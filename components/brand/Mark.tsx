"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";

export type MarkState = "idle" | "listening" | "thinking" | "scanning" | "success" | "error";

/**
 * The assistant's avatar: the Filomina icon with a state treatment –
 * a slow breath while listening, an orbiting brand ring while working,
 * and a badge for success / error.
 */
export function Mark({ state = "idle", size = 40, className, title }: { state?: MarkState; size?: number; className?: string; title?: string }) {
  const busy = state === "thinking" || state === "scanning";
  const breathe = state === "listening";
  const badge = state === "success" ? "success" : state === "error" ? "error" : null;
  const ring = Math.round(size * 0.14);
  return (
    <div className={clsx("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role={title ? "img" : undefined} aria-label={title} aria-hidden={!title}>
      <AnimatePresence>
        {busy && (
          <motion.span
            key="ring"
            className="absolute rounded-full"
            style={{
              inset: -ring,
              background: "conic-gradient(from 0deg, #2f7cff, #6c4dff, #e84393, #ff9a3c, #2f7cff)",
              WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${Math.max(2, ring * 0.5)}px), #000 calc(100% - ${Math.max(2, ring * 0.5)}px + 1px))`,
              mask: `radial-gradient(farthest-side, transparent calc(100% - ${Math.max(2, ring * 0.5)}px), #000 calc(100% - ${Math.max(2, ring * 0.5)}px + 1px))`,
            }}
            initial={{ opacity: 0, rotate: 0, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 360, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ opacity: { duration: 0.2 }, scale: { duration: 0.2 }, rotate: { duration: 1.4, repeat: Infinity, ease: "linear" } }}
          />
        )}
      </AnimatePresence>
      <motion.img
        src="/brand/logo-icon.svg"
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="relative select-none"
        animate={breathe ? { scale: [1, 1.06, 1] } : busy ? { scale: [1, 0.96, 1] } : { scale: 1 }}
        transition={{ duration: breathe ? 2.6 : 1.2, repeat: breathe || busy ? Infinity : 0, ease: "easeInOut" }}
      />
      <AnimatePresence>
        {badge && (
          <motion.span
            key={badge}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={clsx("absolute -bottom-1 -right-1 grid place-items-center rounded-full text-white ring-2 ring-surface", badge === "success" ? "bg-success" : "bg-danger")}
            style={{ width: Math.max(14, size * 0.38), height: Math.max(14, size * 0.38) }}
          >
            {badge === "success" ? <Check style={{ width: size * 0.22, height: size * 0.22 }} strokeWidth={3} /> : <X style={{ width: size * 0.22, height: size * 0.22 }} strokeWidth={3} />}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
