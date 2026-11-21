"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Camera, FolderOpen, Images, ScanFace, Upload, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { useEvent } from "@/components/providers/EventProvider";
import { api } from "@/lib/api";
import type { DriveImage } from "@/lib/types";

export function EventLanding() {
  const event = useEvent()!;
  const [files, setFiles] = useState<DriveImage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .list(event.folderId, { event: event.slug })
      .then((l) => !cancelled && setFiles(l.files.slice(0, 8)))
      .catch(() => !cancelled && setFiles([]));
    return () => {
      cancelled = true;
    };
  }, [event.folderId, event.slug]);

  const ready = event.indexStatus === "done" && event.totalFiles > 0;
  const greeting = ready
    ? `Welcome to ${event.name}! ${event.totalFiles.toLocaleString()} photos are ready. Take a selfie and I'll find every photo you're in.`
    : `Welcome to ${event.name}! Take a selfie and I'll find the photos you're in. ${event.indexedFiles ? `${event.indexedFiles.toLocaleString()} photos are prepared so far.` : ""}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <section className="hero-wash -mx-4 flex flex-col items-center gap-5 rounded-b-[2rem] px-4 pb-8 pt-10 text-center sm:-mx-6 sm:px-6 sm:pt-14">
        <motion.div initial={{ scale: 0.8, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 16 }} className="animate-float">
          <Mark state="idle" size={104} />
        </motion.div>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {event.name}
          </motion.h1>
          {event.description && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mx-auto mt-2 max-w-xl text-muted">
              {event.description}
            </motion.p>
          )}
        </div>
        <AssistantBubble message={greeting} className="w-full max-w-xl text-left" />
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card href={`/e/${event.slug}/search?mode=me`} title="Find me" text="Take a selfie and I'll pull out every photo you appear in." icon={<UserRound className="size-6" />} hint={<><Camera className="size-3.5" /> selfie or upload</>} delay={0.25} />
        <Card href={`/e/${event.slug}/search?mode=someone`} title="Find someone" text="Upload a photo of a friend or family member to find them in the event photos." icon={<Users className="size-6" />} hint={<><Upload className="size-3.5" /> upload or camera</>} delay={0.32} />
      </section>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="card mt-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <FolderOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">All photos</h2>
              <p className="text-sm text-muted">Browse the event&apos;s folders and photos</p>
            </div>
          </div>
          <Link href={`/e/${event.slug}/browse/${event.folderId}`} className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">
            Open <ArrowRight className="size-4" />
          </Link>
        </div>
        {files ? (
          files.length > 0 ? (
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {files.map((f, i) => (
                <motion.div key={f.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.03 }} className="aspect-square overflow-hidden rounded-lg bg-surface-2">
                  <img src={api.thumbUrl(f.id, 160, event.slug)} alt="" loading="lazy" className="size-full object-cover" />
                </motion.div>
              ))}
            </div>
          ) : null
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-lg" />
            ))}
          </div>
        )}
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-muted">
        <div className="card flex items-center justify-center gap-2 px-2 py-3">
          <Images className="size-4 text-accent" />
          <span className="text-base font-semibold text-ink">{event.totalFiles.toLocaleString()}</span> photos
        </div>
        <div className="card flex items-center justify-center gap-2 px-2 py-3">
          <ScanFace className="size-4 text-accent" />
          <span className="text-base font-semibold text-ink">{event.faces.toLocaleString()}</span> faces indexed
        </div>
      </motion.section>
    </main>
  );
}

function Card({ href, title, text, icon, hint, delay }: { href: string; title: string; text: string; icon: React.ReactNode; hint: React.ReactNode; delay: number }) {
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
