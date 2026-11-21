"use client";

import { motion } from "motion/react";
import { Mark, type MarkState } from "@/components/brand/Mark";

export function LoadingScreen({ message, state = "thinking" }: { message: string; state?: MarkState }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <Mark state={state} size={64} />
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm text-sm text-muted">
        {message}
      </motion.p>
    </div>
  );
}
