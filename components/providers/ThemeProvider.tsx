"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";
const KEY = "filomina_theme";

type ThemeCtx = { mode: ThemeMode; resolved: Resolved; setMode: (m: ThemeMode) => void; toggle: () => void };
const Ctx = createContext<ThemeCtx | null>(null);

/** Runs before paint (inlined in the root layout) so the right theme shows immediately. */
export const themeInitScript = `(function(){try{var m=localStorage.getItem(${JSON.stringify(KEY)});var d=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

function systemTheme(): Resolved {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: Resolved) {
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#07080f" : "#f6f7fc");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    let stored: ThemeMode = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") stored = v;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      setModeState(stored);
      setResolved(stored === "system" ? systemTheme() : stored);
    }, 0);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let m: ThemeMode = "system";
      try {
        const v = localStorage.getItem(KEY);
        if (v === "light" || v === "dark") m = v;
      } catch {
        /* ignore */
      }
      if (m === "system") {
        const r = systemTheme();
        setResolved(r);
        apply(r);
      }
    };
    mq.addEventListener("change", onChange);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    try {
      if (m === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
    const r = m === "system" ? systemTheme() : m;
    setModeState(m);
    setResolved(r);
    apply(r);
  }, []);

  const value = useMemo<ThemeCtx>(() => ({ mode, resolved, setMode, toggle: () => setMode(resolved === "dark" ? "light" : "dark") }), [mode, resolved, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}
