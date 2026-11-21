"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useEvent } from "@/components/providers/EventProvider";
import type { DriveImage } from "@/lib/types";

export function PhotoTile({ file, onClick, className, index = 0 }: { file: DriveImage; onClick?: () => void; className?: string; index?: number }) {
  const event = useEvent();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Cached images can finish before React attaches onLoad; check on mount as well.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 24) * 0.02 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={clsx("group relative aspect-square overflow-hidden rounded-lg bg-surface-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50", className)}
      aria-label={file.name}
    >
      {!loaded && !failed && <div className="skeleton absolute inset-0" />}
      {!failed ? (
        <img
          ref={imgRef}
          src={api.thumbUrl(file.id, 320, event?.slug)}
          alt={file.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={clsx("size-full object-cover transition-all duration-300 group-hover:scale-[1.03]", loaded ? "opacity-100" : "opacity-0")}
        />
      ) : (
        <div className="grid size-full place-items-center text-xs text-faint">unavailable</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[11px] text-white/90">{file.name}</p>
      </div>
    </motion.button>
  );
}
