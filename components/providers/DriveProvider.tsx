"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { DriveStatus, SessionUser } from "@/lib/types";

const ROOT_KEY = "filomina_root";

type DriveCtx = {
  loading: boolean;
  status: DriveStatus | null;
  error: string | null;
  rootId: string | null;
  rootName: string | null;
  user: SessionUser | null;
  /** True when the folder can be read right now. */
  connected: boolean;
  setRootOverride: (id: string | null) => void;
  refresh: () => Promise<void>;
  signInHref: (next?: string) => string;
  signOut: () => Promise<void>;
};

const Ctx = createContext<DriveCtx | null>(null);

export function DriveProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setOverride(localStorage.getItem(ROOT_KEY));
      } catch {
        setOverride(null);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (override === undefined) return;
    const my = ++seq.current;
    api
      .status(override)
      .then((s) => {
        if (my !== seq.current) return;
        setStatus(s);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (my !== seq.current) return;
        setError((e as Error).message || "Could not reach the server");
        setLoading(false);
      });
  }, [override, tick]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTick((t) => t + 1);
  }, []);

  const setRootOverride = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(ROOT_KEY, id);
      else localStorage.removeItem(ROOT_KEY);
    } catch {
      /* ignore */
    }
    setLoading(true);
    setOverride(id);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    await refresh();
  }, [refresh]);

  const value = useMemo<DriveCtx>(() => {
    const rootId = status?.folder?.id ?? override ?? null;
    return {
      loading: loading || override === undefined,
      status,
      error,
      rootId,
      rootName: status?.folder?.name ?? null,
      user: status?.user ?? null,
      connected: status?.mode === "public" || status?.mode === "authed",
      setRootOverride,
      refresh,
      signInHref: (next) => `/api/auth/google?next=${encodeURIComponent(next ?? pathname ?? "/")}`,
      signOut,
    };
  }, [status, override, loading, error, setRootOverride, refresh, signOut, pathname]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDrive() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDrive outside DriveProvider");
  return v;
}
