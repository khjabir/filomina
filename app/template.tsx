"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Soft fade-and-rise on every route change. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className="flex min-h-dvh flex-col">
      {children}
    </motion.div>
  );
}
