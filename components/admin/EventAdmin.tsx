"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { api } from "@/lib/api";
import type { EventRecord, IndexRunResult } from "@/lib/types";
import { statusTone } from "./AdminDashboard";
import { useAdmin } from "./AdminGate";
import { useAdminBase } from "./useAdminBase";

export function EventAdmin({ id }: { id: string }) {
  const router = useRouter();
  const { me } = useAdmin();
  const { base } = useAdminBase();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [last, setLast] = useState<IndexRunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      setEvent((await api.admin.getEvent(id)).event);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .getEvent(id)
      .then((r) => !cancelled && setEvent(r.event))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [id]);

  const runIndex = async (fresh = false) => {
    setIndexing(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for (let round = 0; round < 500 && !controller.signal.aborted; round++) {
        const { result, event: ev } = await api.admin.indexEvent(id, { fresh: fresh && round === 0 }, controller.signal);
        setLast(result);
        setEvent(ev);
        if (result.complete || !result.modelsInstalled) break;
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      setIndexing(false);
      void load();
    }
  };

  const update = async (body: Parameters<typeof api.admin.updateEvent>[1], label: string) => {
    setBusy(label);
    setError(null);
    try {
      setEvent((await api.admin.updateEvent(id, body)).event);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this event? The link stops working. Indexed faces stay in the index.")) return;
    setBusy("delete");
    await api.admin.deleteEvent(id);
    router.push(base);
  };

  if (error && !event) return <p className="text-sm text-danger">{error}</p>;
  if (!event) return <div className="skeleton h-40 rounded-2xl" />;

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${event.slug}`;
  const s = statusTone(event);
  const total = event.totalFiles;
  const done = event.indexedFiles;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={base} className="text-xs text-muted hover:text-ink">
            ← All events
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {event.name} <Chip tone={s.tone}>{s.label}</Chip>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {event.folderName || event.folderId} · {event.access === "linked" ? `private folder via ${event.ownerEmail}` : "public folder"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => update({ active: !event.active }, "active")} loading={busy === "active"} icon={event.active ? <Pause className="size-4" /> : <Play className="size-4" />}>
            {event.active ? "Pause link" : "Activate link"}
          </Button>
          <Button variant="danger" size="sm" onClick={remove} loading={busy === "delete"} icon={<Trash2 className="size-4" />}>
            Delete
          </Button>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-faint">Share this link</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 text-sm">{url}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm hover:bg-surface-2">
            <ExternalLink className="size-4" /> Open
          </a>
        </div>
        {!event.active && <p className="mt-2 text-xs text-warning">The link is paused; visitors see “not found” until you activate it.</p>}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Face index</p>
            <p className="text-sm text-muted">
              {done.toLocaleString()} of {total.toLocaleString()} photos analysed · {event.faces.toLocaleString()} faces
              {event.lastIndexedAt ? ` · last run ${new Date(event.lastIndexedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {indexing ? (
              <Button variant="danger" size="sm" onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => runIndex(false)} icon={<Play className="size-4" />}>
                  {event.indexStatus === "done" ? "Check for new photos" : done ? "Continue indexing" : "Start indexing"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => runIndex(true)} icon={<RefreshCw className="size-4" />} title="Re-read the folder tree from Drive">
                  Re-scan folder
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-faint">
          {indexing
            ? `Running… each round analyses photos for a few minutes and continues automatically. ${last ? `Last round: ${last.processed} photos in ${Math.round(last.durationMs / 1000)}s.` : ""}`
            : last && !last.modelsInstalled
              ? "Face models are not installed on the server (npm run fetch-models or FACE_MODELS_URL)."
              : "Indexing runs in rounds that fit serverless time limits. Keep this page open until it reaches 100 %."}
        </p>
        {event.lastError && <p className="mt-2 text-sm text-danger">{event.lastError}</p>}
        {event.access === "linked" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Google link: {event.ownerEmail}.</span>
            {me.canLink ? (
              <Button variant="ghost" size="sm" onClick={() => update({ relink: true }, "relink")} loading={busy === "relink"}>
                Re-link with {me.user?.email}
              </Button>
            ) : (
              <span>Sign in with Google (top right) to re-link if access expires.</span>
            )}
          </div>
        )}
      </div>

      <EditDetails event={event} onSave={(body) => update(body, "details")} busy={busy === "details"} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function EditDetails({ event, onSave, busy }: { event: EventRecord; onSave: (b: { name: string; description: string | null }) => void; busy: boolean }) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? "");
  const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, description: description || null });
      }}
    >
      <p className="font-medium">Details</p>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} h-20 resize-y py-2`} />
      </label>
      <Button type="submit" variant="secondary" size="sm" loading={busy}>
        Save
      </Button>
    </form>
  );
}
