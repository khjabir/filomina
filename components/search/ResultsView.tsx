"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { FolderOpen, Home, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { FaceCrop } from "@/components/drive/FaceCrop";
import { Lightbox } from "@/components/drive/Lightbox";
import { PhotoTile } from "@/components/drive/PhotoTile";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { confidence, matchLabel, strictnessLabel } from "@/lib/face/match";
import type { ModelInfo, SearchMode } from "@/lib/types";
import { matchesAbove, type ScanState } from "./scan-state";

export function ResultsView({
  scan,
  model,
  threshold,
  onThreshold,
  mode,
  queryFaces,
  rootId,
  onAgain,
}: {
  scan: ScanState;
  model: ModelInfo;
  threshold: number;
  onThreshold: (t: number) => void;
  mode: SearchMode;
  queryFaces: string[];
  rootId: string | null;
  onAgain: () => void;
}) {
  const matches = useMemo(() => matchesAbove(scan.items.values(), threshold), [scan.items, threshold]);
  const folders = useMemo(() => new Set(matches.map((m) => m.file.folderId)).size, [matches]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  const folderGroups = useMemo(() => {
    const map = new Map<string, { path: string; count: number }>();
    for (const m of matches) {
      const g = map.get(m.file.folderId) || { path: m.file.path || "Root", count: 0 };
      g.count++;
      map.set(m.file.folderId, g);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [matches]);

  const visible = folderFilter ? matches.filter((m) => m.file.folderId === folderFilter) : matches;
  const who = mode === "me" ? "you" : "this person";
  const message =
    scan.phase === "error"
      ? `Something went wrong while searching: ${scan.error}. Here is what I found before that.`
      : matches.length
        ? `I found ${matches.length} ${matches.length === 1 ? "photo" : "photos"} of ${who} across ${folders} ${folders === 1 ? "folder" : "folders"}${scan.phase === "cancelled" ? " before you stopped me" : ""}. Tap any photo to see it big or open it in Drive.`
        : `I compared ${scan.faces.toLocaleString()} faces in ${scan.collected.toLocaleString()} photos but couldn't find ${who}. Try relaxing the strictness below, or add a clearer photo.`;
  const t = model.thresholds;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
      <div className="flex items-start gap-3">
        {queryFaces.length > 0 && (
          <div className="hidden shrink-0 -space-x-3 sm:flex">
            {queryFaces.map((src, i) => (
              <motion.img key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} src={src} alt="" className="size-14 rounded-xl border-2 border-surface object-cover shadow-card" />
            ))}
          </div>
        )}
        <AssistantBubble message={message} state={matches.length ? "success" : "idle"} className="flex-1" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="strictness" className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-4 text-accent" /> Match strictness
          </label>
          <span className="text-xs text-muted">{strictnessLabel(threshold, model)}</span>
        </div>
        <input id="strictness" type="range" className="slider mt-3 w-full" min={t.relaxed} max={t.strict} step={0.005} value={threshold} onChange={(e) => onThreshold(Number(e.target.value))} />
        <div className="mt-1 flex justify-between text-[11px] uppercase tracking-wider text-faint">
          <span>Relaxed</span>
          <span>Strict</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{scan.collected.toLocaleString()} photos</Chip>
          <Chip>{scan.foldersVisited} folders</Chip>
          <Chip>{scan.faces.toLocaleString()} faces compared</Chip>
          <Chip>{(scan.durationMs / 1000).toFixed(1)}s</Chip>
        </div>
      </div>

      {folderGroups.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <FilterChip active={!folderFilter} onClick={() => setFolderFilter(null)}>
            All · {matches.length}
          </FilterChip>
          {folderGroups.map(([id, g]) => (
            <FilterChip key={id} active={folderFilter === id} onClick={() => setFolderFilter(folderFilter === id ? null : id)}>
              <FolderOpen className="size-3.5" />
              <span className="max-w-[12rem] truncate">{g.path}</span> · {g.count}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((m, i) => (
          <motion.div key={m.file.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.03 }} className="flex flex-col gap-1.5">
            <div className="relative">
              <PhotoTile file={m.file} index={i} onClick={() => setLightbox(matches.indexOf(m))} className="w-full" />
              <div className="pointer-events-none absolute left-2 top-2">
                <FaceCrop fileId={m.file.id} box={m.box} size={160} className="size-9 rounded-lg border-2 border-success" />
              </div>
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{Math.round(confidence(m.sim, model) * 100)}%</span>
            </div>
            <p className="truncate px-1 text-[11px] text-faint" title={m.file.path}>
              {matchLabel(m.sim, model)}
              {m.size < 40 ? " · small face" : ""} · {m.file.path || "Root"}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button variant="secondary" size="lg" onClick={onAgain} icon={<RotateCcw className="size-4" />}>
          Search again
        </Button>
        {rootId && (
          <LinkButton href={`/browse/${rootId}`} variant="ghost" size="lg" icon={<FolderOpen className="size-4" />}>
            Browse photos
          </LinkButton>
        )}
        <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-muted hover:text-ink">
          <Home className="size-4" /> Home
        </Link>
      </div>

      <Lightbox
        items={matches.map((m) => ({
          file: m.file,
          path: m.file.path || "Root",
          box: m.box,
          caption: (
            <Chip tone="success">
              {Math.round(confidence(m.sim, model) * 100)}% · {matchLabel(m.sim, model)}
            </Chip>
          ),
        }))}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndex={setLightbox}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}
