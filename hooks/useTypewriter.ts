"use client";

import { useEffect, useState } from "react";

/** Reveals `text` character by character. Re-runs whenever `text` changes. */
export function useTypewriter(text: string, cps = 55, enabled = true) {
  const [state, setState] = useState<{ text: string; shown: string }>({ text, shown: "" });

  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const chars = Math.floor(((now - last) / 1000) * cps);
      if (chars >= 1) {
        i = Math.min(text.length, i + chars);
        last = now;
        setState({ text, shown: text.slice(0, i) });
      }
      if (i < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, cps, enabled]);

  // A different `text` than the one in state means the animation has not started yet.
  const shown = !enabled ? text : state.text === text ? state.shown : "";
  return { shown, done: shown.length >= text.length };
}
