"use client";

import { motion } from "motion/react";
import { Download, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { api, ApiError } from "@/lib/api";
import type { AuditRecord } from "@/lib/types";

export function AuditViewer() {
  const [records, setRecords] = useState<AuditRecord[] | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { records } = await api.auditList(500);
      setRecords(records);
      setNeedsKey(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsKey(true);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .auditList(500)
      .then(({ records }) => {
        if (cancelled) return;
        setRecords(records);
        setNeedsKey(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) setNeedsKey(true);
        else setError((e as Error).message);
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
      await api.auditLogin(key);
      setKey("");
      await load();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const logout = async () => {
    await api.auditLogout();
    setRecords(null);
    setNeedsKey(true);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `filomina-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <ShieldCheck className="size-6 text-accent" /> Audit log
          </h1>
          <p className="mt-1 text-sm text-muted">Every face search and consent decision, with the photo that was searched with.</p>
        </div>
        {records && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} loading={busy} icon={<RefreshCw className="size-4" />}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJson} icon={<Download className="size-4" />}>
              Export JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="size-4" />}>
              Lock
            </Button>
          </div>
        )}
      </div>

      {needsKey && (
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={login} className="card mx-auto mt-10 max-w-sm space-y-3 p-5">
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
          <Button type="submit" fullWidth loading={busy}>
            Unlock
          </Button>
        </motion.form>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {records && (
        <div className="mt-6 space-y-2">
          {records.length === 0 && <p className="card p-6 text-center text-muted">No entries yet.</p>}
          {records.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }} className="card flex gap-4 p-3">
              {r.type === "search" ? (
                <img src={api.auditPhotoUrl(r.id, 0)} alt="" className="size-20 shrink-0 rounded-lg bg-surface-2 object-cover" loading="lazy" />
              ) : (
                <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-surface-2 text-faint">
                  <ShieldCheck className="size-6" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.type === "search" ? (
                    <>
                      <Chip tone="accent">{r.mode === "me" ? "Find me" : "Find someone"}</Chip>
                      <Chip tone={r.status === "completed" ? "success" : r.status === "started" ? "warning" : "default"}>{r.status}</Chip>
                      {r.matches !== undefined && <Chip>{r.matches} matches</Chip>}
                      {r.scanned !== undefined && <Chip>{r.scanned} photos</Chip>}
                      {r.referencePhotos > 1 && <Chip>{r.referencePhotos} reference photos</Chip>}
                      {r.eventName && <Chip tone="accent">event · {r.eventName}</Chip>}
                    </>
                  ) : (
                    <Chip tone={r.choice === "accepted" ? "success" : "danger"}>consent {r.choice}</Chip>
                  )}
                  <span className="ml-auto text-xs text-faint">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1.5 truncate">
                  <span className="text-muted">Who:</span> {r.user ? `${r.user.name ?? ""} <${r.user.email}>` : "anonymous"} · <span className="text-muted">IP:</span> {r.ip ?? "?"}
                </p>
                {r.type === "search" && (
                  <p className="truncate">
                    <span className="text-muted">Folder:</span> {r.folderName || r.folderId} · <span className="text-muted">faces in photo:</span> {r.facesDetected}
                    {r.durationMs ? ` · ${Math.round(r.durationMs / 1000)}s` : ""}
                  </p>
                )}
                <p className="truncate text-xs text-faint" title={r.userAgent ?? ""}>
                  {r.userAgent}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
