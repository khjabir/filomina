"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/types";

export type ConsentStatus = "unknown" | "accepted" | "declined";

type ConsentCtx = {
  ready: boolean;
  status: ConsentStatus;
  sheetOpen: boolean;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  /** Opens the consent sheet; `onDecision` fires once the visitor accepts or declines. */
  openSheet: (onDecision?: (choice: "accepted" | "declined") => void) => void;
  closeSheet: () => void;
};

const Ctx = createContext<ConsentCtx | null>(null);

function readCookie(): ConsentStatus {
  try {
    const raw = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${CONSENT_COOKIE}=`));
    if (!raw) return "unknown";
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1))) as { v?: string; c?: string };
    if (parsed.v !== CONSENT_VERSION) return "unknown";
    return parsed.c === "accepted" ? "accepted" : parsed.c === "declined" ? "declined" : "unknown";
  } catch {
    return "unknown";
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>("unknown");
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const decisionRef = useRef<((choice: "accepted" | "declined") => void) | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setStatus(readCookie());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const choose = useCallback(async (choice: "accepted" | "declined") => {
    try {
      await api.consent(choice, CONSENT_VERSION);
    } catch {
      // Fall back to a client-side cookie so the UI still works offline/dev.
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, c: choice, at: Date.now() }))}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
    }
    setStatus(choice);
    setSheetOpen(false);
    const cb = decisionRef.current;
    decisionRef.current = null;
    cb?.(choice);
  }, []);

  const value = useMemo<ConsentCtx>(
    () => ({
      ready,
      status,
      sheetOpen,
      accept: () => choose("accepted"),
      decline: () => choose("declined"),
      openSheet: (onDecision) => {
        decisionRef.current = onDecision ?? null;
        setSheetOpen(true);
      },
      closeSheet: () => {
        decisionRef.current = null;
        setSheetOpen(false);
      },
    }),
    [ready, status, sheetOpen, choose],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsent() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConsent outside ConsentProvider");
  return v;
}
