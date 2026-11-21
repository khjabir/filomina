"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, FolderOpen, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { LinkButton } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { EventRecord } from "@/lib/types";
import { useAdminBase } from "./useAdminBase";

export function statusTone(e: EventRecord): { tone: "default" | "accent" | "success" | "warning" | "danger"; label: string } {
  if (!e.active) return { tone: "default", label: "paused" };
  if (e.indexStatus === "error") return { tone: "danger", label: "error" };
  if (e.indexStatus === "running") return { tone: "warning", label: `indexing ${e.indexedFiles}/${e.totalFiles}` };
  if (e.indexStatus === "done") return { tone: "success", label: "ready" };
  return { tone: "accent", label: "not indexed yet" };
}

export function AdminDashboard() {
  const { base } = useAdminBase();
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .events()
      .then((r) => !cancelled && setEvents(r.events))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Events</h1>
          <p className="mt-1 text-sm text-muted">Each event is a Drive folder with its own shareable link. Index it once; guests search instantly.</p>
        </div>
        <LinkButton href={`${base}/events/new`} icon={<CalendarPlus className="size-4" />}>
          New event
        </LinkButton>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {!events && !error && (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      )}
      {events && events.length === 0 && (
        <div className="card mt-6 flex flex-col items-center gap-3 p-10 text-center text-muted">
          <CalendarPlus className="size-8 text-faint" />
          <p>No events yet. Create one to get a shareable link for a folder.</p>
        </div>
      )}
      {events && events.length > 0 && (
        <div className="mt-6 space-y-2">
          {events.map((e, i) => {
            const s = statusTone(e);
            return (
              <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                <Link href={`${base}/events/${e.id}`} className="card flex items-center gap-4 p-4 transition hover:border-accent/60">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <FolderOpen className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{e.name}</p>
                      <Chip tone={s.tone}>{s.label}</Chip>
                      {e.access === "linked" && <Chip>private · via {e.ownerEmail}</Chip>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {e.folderName || e.folderId} · {e.totalFiles.toLocaleString()} photos · {e.faces.toLocaleString()} faces
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-faint">
                      <Link2 className="size-3" /> /e/{e.slug}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-faint" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
