"use client";

import { AnimatePresence, motion } from "motion/react";
import { Database, Folder, Images, ScanFace, Sparkles, Square, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Mark } from "@/components/brand/Mark";
import { FaceCrop } from "@/components/drive/FaceCrop";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { api } from "@/lib/api";
import { useEvent } from "@/components/providers/EventProvider";
import { confidence } from "@/lib/face/match";
import type { SearchMode } from "@/lib/types";
import type { ScanState } from "./scan-state";

function fmtEta(ms: number | null) {
  if (ms === null) return "estimating…";
  const s = Math.round(ms / 1000);
  if (s < 5) return "almost done";
  if (s < 60) return `about ${s}s left`;
  return `about ${Math.round(s / 60)} min left`;
}

type Particle = { id: number; x: number; y: number; r: number };

export function ScanStage({
  scan,
  queryFaces,
  mode,
  onStop,
  onShowResults,
}: {
  scan: ScanState;
  queryFaces: string[];
  mode: SearchMode;
  onStop: () => void;
  onShowResults: () => void;
}) {
  const event = useEvent();
  const collecting = scan.phase === "collect";
  const finished = scan.phase === "done" || scan.phase === "cancelled" || scan.phase === "error";
  const toIndex = scan.indexed + scan.pending;
  const pct = toIndex ? scan.indexed / toIndex : scan.phase === "match" || finished ? 1 : 0;
  const model = scan.model;

  /* small tiles flying into the pile while folders are being collected */
  const [particles, setParticles] = useState<Particle[]>([]);
  const pid = useRef(0);
  const lastFolders = useRef(0);
  useEffect(() => {
    if (!collecting || scan.folders.length === lastFolders.current) return;
    lastFolders.current = scan.folders.length;
    const fresh: Particle[] = Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 140;
      return { id: pid.current++, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: (Math.random() - 0.5) * 50 };
    });
    const t = setTimeout(() => setParticles((p) => [...p.slice(-16), ...fresh]), 0);
    return () => clearTimeout(t);
  }, [scan.folders.length, collecting]);

  const recent = scan.matches.slice(-14).reverse();
  const who = mode === "me" ? "you" : "this person";
  const message = finished
    ? scan.phase === "error"
      ? scan.error || "Something went wrong."
      : scan.matches.length
        ? `All done. I found ${scan.matches.length} ${scan.matches.length === 1 ? "photo" : "photos"} of ${who}.`
        : `I went through everything but couldn't find ${who}. You can relax the strictness on the next screen.`
    : scan.message;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <AssistantBubble compact typewriter={false} state={finished ? (scan.phase === "error" ? "error" : "success") : "scanning"} message={message} />

      <div className="card overflow-hidden">
        <div className="relative aspect-[4/3] bg-surface-2 sm:aspect-[16/10]">
          <div className="scan-grid pointer-events-none absolute inset-0" />
          <AnimatePresence mode="wait">
            {collecting ? (
              <motion.div key="collect" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative">
                    {[2, 1, 0].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface shadow-card"
                        animate={{ rotate: [i * 6 - 6, i * 6 - 2, i * 6 - 6], y: [-i * 3, -i * 3 - 3, -i * 3] }}
                        transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ))}
                    <div className="relative grid h-24 w-20 place-items-center">
                      <Images className="size-7 text-accent" />
                    </div>
                    {particles.map((p) => (
                      <motion.div
                        key={p.id}
                        className="absolute left-1/2 top-1/2 h-10 w-8 -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-accent-soft"
                        initial={{ x: p.x, y: p.y, opacity: 0, rotate: p.r, scale: 1 }}
                        animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0], rotate: 0, scale: [1, 1, 0.7, 0.4] }}
                        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
                        onAnimationComplete={() => setParticles((list) => list.filter((q) => q.id !== p.id))}
                      />
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                  <motion.p key={scan.collected} initial={{ scale: 1.12, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl font-semibold tabular-nums tracking-tight">
                    {scan.collected.toLocaleString()}
                  </motion.p>
                  <p className="text-sm text-muted">
                    photos found in {scan.foldersVisited} {scan.foldersVisited === 1 ? "folder" : "folders"}
                  </p>
                </div>
                <div className="absolute left-3 top-3 flex max-w-[70%] flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {scan.folders.slice(-4).map((f) => (
                      <motion.div
                        key={f.id}
                        layout
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="flex items-center gap-1.5 truncate rounded-full border border-line bg-surface px-2.5 py-1 text-xs shadow-card"
                      >
                        <Folder className="size-3.5 shrink-0 text-accent" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-faint">· {f.files}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div key="scan" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {scan.frame ? (
                  <div key={scan.frame.file.id} className="absolute inset-0 bg-black">
                    <img src={api.thumbUrl(scan.frame.file.id, 640, event?.slug)} alt="" className="absolute inset-0 size-full object-contain" />
                    {!finished && <span className="scanline" />}
                    {scan.frame.faces.map((f, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 1.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                        className={`absolute rounded-md border-2 ${f.match ? "border-success shadow-[0_0_0_3px_rgba(52,211,153,.35)]" : "border-white/80"}`}
                        style={{ left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%` }}
                      >
                        {f.match && model && (
                          <span className="absolute -top-5 left-0 rounded bg-success px-1 py-0.5 text-[10px] font-semibold text-white">{Math.round(confidence(f.sim, model) * 100)}%</span>
                        )}
                      </motion.span>
                    ))}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white">
                      <p className="truncate text-xs text-white/70">{scan.frame.file.path || "Root folder"}</p>
                      <p className="truncate text-sm font-medium">{scan.frame.file.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-center text-sm text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <Mark state={finished ? "success" : "scanning"} size={56} />
                      {finished ? "Scan complete" : scan.phase === "match" ? `Comparing with ${scan.faces.toLocaleString()} faces I already know…` : "Starting…"}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {queryFaces.length > 0 && (
            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-line bg-surface p-1 pr-3 text-xs shadow-card">
              <div className="flex -space-x-2">
                {queryFaces.map((src, i) => (
                  <img key={i} src={src} alt="" className="size-7 rounded-full border-2 border-surface object-cover" />
                ))}
              </div>
              <span className="text-muted">{mode === "me" ? "Looking for you" : "Looking for them"}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line p-4">
          <ProgressRing value={pct} size={80} stroke={8} indeterminate={collecting}>
            <span className="text-base font-semibold tabular-nums">{collecting ? "…" : `${Math.round(pct * 100)}%`}</span>
          </ProgressRing>
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <Stat icon={<Images className="size-3.5" />} label="Photos" value={scan.collected.toLocaleString()} />
            <Stat icon={<ScanFace className="size-3.5" />} label="Faces" value={scan.faces.toLocaleString()} />
            <Stat icon={<Sparkles className="size-3.5" />} label="Matches" value={scan.matches.length} highlight={scan.matches.length > 0} />
          </div>
        </div>
        {!collecting && !finished && (
          <p className="flex flex-wrap items-center justify-center gap-x-3 px-4 pb-3 text-center text-xs text-faint">
            {scan.pending > 0 ? <span>Analysing {scan.pending.toLocaleString()} new {scan.pending === 1 ? "photo" : "photos"} · {fmtEta(scan.etaMs)}</span> : <span>Matching…</span>}
            {scan.known > 0 && (
              <span className="flex items-center gap-1">
                <Database className="size-3" /> {scan.known.toLocaleString()} already indexed
              </span>
            )}
          </p>
        )}
      </div>

      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-faint">
          <span className="flex items-center gap-1.5">
            <UsersRound className="size-3.5" /> Matches so far
          </span>
          <span>{scan.matches.length}</span>
        </div>
        <div className="no-scrollbar flex min-h-14 gap-2 overflow-x-auto px-1 pb-1">
          <AnimatePresence initial={false}>
            {recent.map((m) => (
              <motion.div
                key={m.file.id}
                layout
                initial={{ scale: 0, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="relative shrink-0"
              >
                <FaceCrop fileId={m.file.id} box={m.box} size={160} className="size-14 rounded-xl border-2 border-success" />
                {model && <span className="absolute -bottom-1 -right-1 rounded-full bg-success px-1.5 text-[10px] font-semibold text-white">{Math.round(confidence(m.sim, model) * 100)}%</span>}
              </motion.div>
            ))}
          </AnimatePresence>
          {!recent.length && <p className="self-center px-1 text-sm text-faint">{finished ? "No matches." : "Matches appear here as I find them."}</p>}
        </div>
      </div>

      <div className="flex justify-center gap-2 pb-2">
        {finished ? (
          <Button size="xl" onClick={onShowResults} icon={<Sparkles className="size-4" />}>
            {scan.matches.length ? `Show ${scan.matches.length} ${scan.matches.length === 1 ? "match" : "matches"}` : "See results"}
          </Button>
        ) : (
          <Button variant="danger" size="lg" onClick={onStop} icon={<Square className="size-4" />}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${highlight ? "bg-success-soft text-success" : "bg-surface-2"}`}>
      <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-faint">
        {icon}
        {label}
      </div>
      <motion.p key={String(value)} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="mt-0.5 truncate text-base font-semibold tabular-nums">
        {value}
      </motion.p>
    </div>
  );
}
