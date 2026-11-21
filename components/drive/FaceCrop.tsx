"use client";

import { clsx } from "clsx";
import { api } from "@/lib/api";
import { useEvent } from "@/components/providers/EventProvider";
import type { NormBox } from "@/lib/types";

/** Shows just the face region of a Drive photo using CSS positioning on the proxied thumbnail. */
export function FaceCrop({ fileId, box, className, margin = 0.45, size = 320 }: { fileId: string; box: NormBox; className?: string; margin?: number; size?: 160 | 320 | 512 }) {
  const event = useEvent();
  const side = Math.max(box.w, box.h);
  const w = Math.min(1, box.w + side * margin * 2);
  const h = Math.min(1, box.h + side * margin * 2);
  const x = Math.max(0, Math.min(1 - w, box.x - (w - box.w) / 2));
  const y = Math.max(0, Math.min(1 - h, box.y - (h - box.h) / 2));
  return (
    <div className={clsx("relative overflow-hidden bg-surface-2", className)}>
      <img
        src={api.thumbUrl(fileId, size, event?.slug)}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ width: `${100 / w}%`, height: `${100 / h}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
        loading="lazy"
      />
    </div>
  );
}
