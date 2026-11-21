"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FolderOpen, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useEvent } from "@/components/providers/EventProvider";
import type { DriveImage, NormBox } from "@/lib/types";

export type LightboxItem = { file: DriveImage; path?: string; box?: NormBox; caption?: React.ReactNode };

const btn = "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition";

export function Lightbox({ items, index, onClose, onIndex }: { items: LightboxItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const event = useEvent();
  const item = index === null ? null : items[index];
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loaded = item !== null && loadedId === item.file.id;
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el && item && el.complete && el.naturalWidth > 0) setLoadedId(item.file.id);
    },
    [item],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onClose, onIndex]);

  return (
    <AnimatePresence>
      {item && index !== null && (
        <motion.div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="flex items-center justify-between gap-3 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate font-medium">{item.file.name}</p>
              {item.path && (
                <p className="flex items-center gap-1 truncate text-xs text-white/60">
                  <FolderOpen className="size-3.5 shrink-0" /> {item.path}
                </p>
              )}
            </div>
            <button onClick={onClose} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2" onClick={(e) => e.stopPropagation()}>
            <motion.div key={item.file.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative max-h-full max-w-full">
              {!loaded && <div className="skeleton absolute inset-0 rounded-xl opacity-30" />}
              <img
                ref={imgRef}
                src={api.thumbUrl(item.file.id, 1600, event?.slug)}
                alt={item.file.name}
                onLoad={() => setLoadedId(item.file.id)}
                className="max-h-[70dvh] max-w-full rounded-xl object-contain"
                style={{ opacity: loaded ? 1 : 0, transition: "opacity .25s" }}
              />
              {item.box && loaded && (
                <motion.span
                  initial={{ opacity: 0, scale: 1.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
                  className="pointer-events-none absolute rounded-md border-2 border-success shadow-[0_0_0_3px_rgba(52,211,153,.3)]"
                  style={{ left: `${item.box.x * 100}%`, top: `${item.box.y * 100}%`, width: `${item.box.w * 100}%`, height: `${item.box.h * 100}%` }}
                />
              )}
            </motion.div>
            {index > 0 && (
              <button onClick={() => onIndex(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 hover:bg-black/70" aria-label="Previous">
                <ChevronLeft className="size-6" />
              </button>
            )}
            {index < items.length - 1 && (
              <button onClick={() => onIndex(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 hover:bg-black/70" aria-label="Next">
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 p-3 safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-white/70">{item.caption}</div>
            <div className="flex gap-2">
              <a href={api.mediaUrl(item.file.id, event?.slug)} className={`${btn} bg-white/10 hover:bg-white/20`} download>
                <Download className="size-4" /> Download
              </a>
              {item.file.webViewLink && (
                <a href={item.file.webViewLink} target="_blank" rel="noreferrer" className={`${btn} bg-white text-black hover:bg-white/90`}>
                  <ExternalLink className="size-4" /> Open in Drive
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
