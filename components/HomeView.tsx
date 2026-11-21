"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Camera, Database, Folder, FolderOpen, Loader2, ScanFace, Upload, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { useDrive } from "@/components/providers/DriveProvider";
import { api, type IndexStatusResponse } from "@/lib/api";
import type { DriveFolder, DriveImage, IndexRunResult } from "@/lib/types";

export function HomeView() {
  const { rootId, rootName, user } = useDrive();
  const [preview, setPreview] = useState<{ folders: DriveFolder[]; files: DriveImage[] } | null>(null);
  const [index, setIndex] = useState<IndexStatusResponse | null>(null);
  const [run, setRun] = useState<IndexRunResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!rootId) return;
    let cancelled = false;
    const controller = new AbortController();
    api
      .list(rootId)
      .then((l) => !cancelled && setPreview({ folders: l.folders.slice(0, 6), files: l.files.slice(0, 8) }))
      .catch(() => undefined);
    api
      .indexStatus(rootId)
      .then((s) => !cancelled && setIndex(s))
      .catch(() => undefined);
    // Pre-warm: analyse this folder in short rounds while the page is open, so searches are instant later.
    const warm = async () => {
      setRunning(true);
      try {
        for (let round = 0; round < 200 && !cancelled; round++) {
          const r = await api.indexRun({ root: rootId, rootName: rootName || "folder", budgetMs: 45_000 }, controller.signal);
          if (cancelled) return;
          setRun(r);
          if (r.complete || !r.modelsInstalled) break;
        }
      } catch {
        /* offline, aborted, or not signed in – ignore */
      } finally {
        if (!cancelled) setRunning(false);
      }
    };
    void warm();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rootId, rootName]);

  const firstName = user?.name?.split(" ")[0];
  const greeting = `${firstName ? `Hi ${firstName}!` : "Hi!"} I can find people in the photos inside “${rootName ?? "your folder"}”, even deep in sub-folders. Want me to find you?`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <section className="hero-wash -mx-4 flex flex-col items-center gap-5 rounded-b-[2rem] px-4 pb-8 pt-10 text-center sm:-mx-6 sm:px-6 sm:pt-14">
        <motion.div initial={{ scale: 0.8, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 16 }} className="animate-float">
          <Mark state="idle" size={104} />
        </motion.div>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Find anyone in your <span className="text-brand">shared photos</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-2 text-muted">
            Face search across every folder of a shared Google Drive.
          </motion.p>
        </div>
        <AssistantBubble message={greeting} className="w-full max-w-xl text-left" />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <ActionCard
          href="/search?mode=me"
          title="Find me"
          text="Take a selfie and I'll pull out every photo you appear in."
          icon={<UserRound className="size-6" />}
          hint={
            <>
              <Camera className="size-3.5" /> selfie or upload
            </>
          }
          delay={0.25}
        />
        <ActionCard
          href="/search?mode=someone"
          title="Find someone"
          text="Upload a photo of a friend or family member to find them across every folder."
          icon={<Users className="size-6" />}
          hint={
            <>
              <Upload className="size-3.5" /> upload or camera
            </>
          }
          delay={0.32}
        />
      </section>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="card mt-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <FolderOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{rootName ?? "Your folder"}</h2>
              <p className="text-sm text-muted">Browse folders and photos like in Google Drive</p>
            </div>
          </div>
          {rootId && (
            <Link href={`/browse/${rootId}`} className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">
              Open <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        {preview ? (
          <div className="mt-4 space-y-3">
            {preview.folders.length > 0 && (
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {preview.folders.map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.04 }}>
                    <Link href={`/browse/${f.id}`} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-accent/50">
                      <Folder className="size-4 text-accent" />
                      <span className="max-w-[12rem] truncate">{f.name}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
            {preview.files.length > 0 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {preview.files.map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.03 }} className="aspect-square overflow-hidden rounded-lg bg-surface-2">
                    <img src={api.thumbUrl(f.id, 160)} alt="" loading="lazy" className="size-full object-cover" />
                  </motion.div>
                ))}
              </div>
            )}
            {!preview.folders.length && !preview.files.length && <p className="text-sm text-faint">This folder looks empty.</p>}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-lg" />
            ))}
          </div>
        )}
      </motion.section>

      <IndexCard index={index} run={run} running={running} />
    </main>
  );
}

function IndexCard({ index, run, running }: { index: IndexStatusResponse | null; run: IndexRunResult | null; running: boolean }) {
  if (!index) return null;
  if (!index.modelsInstalled || (run && !run.modelsInstalled)) {
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium text-ink">Face models are not installed on this server</p>
          <p className="mt-0.5 text-muted">
            Run <code className="rounded bg-surface px-1 py-0.5 text-xs">npm run fetch-models</code> once (or set FACE_MODELS_URL), then restart the app. Browsing works without them.
          </p>
        </div>
      </motion.section>
    );
  }
  const total = run?.total ?? 0;
  const done = run ? run.total - run.pending : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const busy = running && run && !run.complete;
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-3 flex items-center gap-4 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{busy || (running && !run) ? <Loader2 className="size-5 animate-spin" /> : <Database className="size-5" />}</span>
      <div className="min-w-0 flex-1">
        {running && !run ? (
          <p className="text-sm font-medium">Checking which photos still need analysing…</p>
        ) : busy ? (
          <>
            <p className="text-sm font-medium">
              Analysing faces · {done.toLocaleString()} of {total.toLocaleString()} photos
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-faint">Keep this page open and searches will be instant afterwards. You can already search now.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              {run ? `${run.total.toLocaleString()} photos in ${run.folders} folders · ${(run.total - run.pending).toLocaleString()} analysed` : `${index.stats.files.toLocaleString()} photos · ${index.stats.faces.toLocaleString()} faces indexed`}
            </p>
            <p className="text-xs text-faint">{run?.complete ? "Ready for instant search. New photos are picked up automatically." : run ? `${run.pending.toLocaleString()} photos will be analysed on the next visit or search.` : "Ready."}</p>
          </>
        )}
      </div>
      <ScanFace className="size-5 shrink-0 text-faint" />
    </motion.section>
  );
}

function ActionCard({ href, title, text, icon, hint, delay }: { href: string; title: string; text: string; icon: React.ReactNode; hint: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
      <Link href={href} className="card group block p-5 transition hover:border-accent/60">
        <div className="flex items-start gap-4">
          <span className="brand-gradient glow-brand grid size-12 shrink-0 place-items-center rounded-xl text-white">{icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">{hint}</p>
          </div>
          <ArrowRight className="mt-1 size-5 shrink-0 text-faint transition group-hover:translate-x-1 group-hover:text-accent" />
        </div>
      </Link>
    </motion.div>
  );
}
