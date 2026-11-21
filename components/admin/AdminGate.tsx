"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { KeyRound, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { api, ApiError, type AdminMe } from "@/lib/api";
import { useDrive } from "@/components/providers/DriveProvider";
import { useAdminBase } from "./useAdminBase";

const Ctx = createContext<{ me: AdminMe; refresh: () => Promise<void>; lock: () => Promise<void> } | null>(null);

export function useAdmin() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin outside AdminGate");
  return v;
}

/** Unlocks the admin area with AUDIT_ADMIN_KEY (stored as an HTTP-only cookie). */
export function AdminGate({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [state, setState] = useState<"loading" | "locked" | "disabled" | "ok">("loading");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signInHref } = useDrive();
  const { base, audit } = useAdminBase();

  const refresh = useCallback(async () => {
    try {
      const m = await api.admin.me();
      setMe(m);
      setState("ok");
    } catch (e) {
      if (e instanceof ApiError && e.code === "admin-disabled") setState("disabled");
      else setState("locked");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .me()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setState("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState(e instanceof ApiError && e.code === "admin-disabled" ? "disabled" : "locked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.admin.login(key);
      setKey("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await api.admin.logout();
    setMe(null);
    setState("locked");
  };

  if (state === "loading") return <div className="mx-auto max-w-5xl p-6 text-sm text-muted">Checking access…</div>;
  if (state === "disabled")
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="card p-5 text-sm text-muted">
          The admin area is disabled. Set <code className="rounded bg-surface-2 px-1 py-0.5 text-xs text-ink">AUDIT_ADMIN_KEY</code> on the server to enable it.
        </div>
      </div>
    );
  if (state === "locked" || !me)
    return (
      <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={login} className="card mx-auto mt-10 max-w-sm space-y-3 p-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-accent" /> Admin
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted">
          <KeyRound className="size-4 text-accent" /> Enter the administrator key (AUDIT_ADMIN_KEY).
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          placeholder="Admin key"
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" fullWidth loading={busy}>
          Unlock
        </Button>
      </motion.form>
    );

  return (
    <Ctx.Provider value={{ me, refresh, lock }}>
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <nav className="flex items-center gap-1">
            <Link href={base} className="rounded-lg px-3 py-1.5 font-medium hover:bg-surface-2">
              Events
            </Link>
            <Link href={audit} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
              Audit log
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {me.user ? (
              <span className="hidden text-xs text-muted sm:inline">Google: {me.user.email}</span>
            ) : me.oauthConfigured ? (
              <a href={signInHref(base)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs hover:bg-surface-2">
                <LogIn className="size-3.5" /> Sign in with Google (for private folders)
              </a>
            ) : null}
            <Button variant="ghost" size="sm" onClick={lock} icon={<LogOut className="size-4" />}>
              Lock
            </Button>
          </div>
        </div>
        {children}
      </div>
    </Ctx.Provider>
  );
}
