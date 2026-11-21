"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function ProgressRing({ value, size = 96, stroke = 8, children, indeterminate }: { value: number; size?: number; stroke?: number; children?: ReactNode; indeterminate?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <motion.svg
        width={size}
        height={size}
        style={{ rotate: -90 }}
        animate={indeterminate ? { rotate: [-90, 270] } : { rotate: -90 }}
        transition={indeterminate ? { duration: 1.4, repeat: Infinity, ease: "linear" } : { duration: 0 }}
      >
        <defs>
          <linearGradient id="ring-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2f7cff" />
            <stop offset="55%" stopColor="#6c4dff" />
            <stop offset="100%" stopColor="#e84393" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animate={{ strokeDashoffset: indeterminate ? c * 0.75 : c * (1 - v) }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </motion.svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
