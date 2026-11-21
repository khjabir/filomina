"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Sun/moon switch. Click toggles light ↔ dark; "system" can be restored from the menu. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={clsx("relative grid size-9 place-items-center overflow-hidden rounded-full border border-line bg-surface text-muted transition hover:text-ink hover:shadow-card", className)}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ y: 12, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -12, opacity: 0, rotate: 40 }}
          transition={{ duration: 0.22 }}
          className="grid place-items-center"
        >
          {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
