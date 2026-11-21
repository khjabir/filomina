"use client";

import { motion } from "motion/react";
import { Check, Plus, RotateCcw, ScanFace } from "lucide-react";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Button } from "@/components/ui/Button";
import type { QueryFace, SearchMode } from "@/lib/types";

export function FacePicker({
  imageUrl,
  width,
  height,
  faces,
  selected,
  mode,
  referenceFaces,
  onSelect,
  onConfirm,
  onRetake,
  busy,
}: {
  imageUrl: string;
  width: number;
  height: number;
  faces: QueryFace[];
  selected: number;
  mode: SearchMode;
  /** avatars of references already confirmed */
  referenceFaces: string[];
  onSelect: (i: number) => void;
  onConfirm: (action: "search" | "add") => void;
  onRetake: () => void;
  busy?: boolean;
}) {
  const many = faces.length > 1;
  const who = mode === "me" ? "you" : "this person";
  const message =
    faces.length === 0
      ? "I couldn't find a face in that photo. Try again with better light and the face looking at the camera."
      : many
        ? `I can see ${faces.length} faces. Tap the one that's ${who}.`
        : referenceFaces.length
          ? `Got it, that's reference photo ${referenceFaces.length + 1}. Search now, or add one more.`
          : mode === "me"
            ? "Got you! Shall I look for you in the photos? Adding a second photo from a different angle makes matching more reliable."
            : "Got it. Shall I look for this person? A second photo from another angle improves accuracy.";

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="relative mx-auto" style={{ aspectRatio: `${width} / ${height}`, maxHeight: "58dvh" }}>
          <img src={imageUrl} alt="Your photo" className="size-full object-contain" />
          {faces.map((f, i) => {
            const active = i === selected;
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                initial={{ opacity: 0, scale: 1.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 260, damping: 20 }}
                className={`absolute rounded-lg border-2 transition ${active ? "border-accent shadow-[0_0_0_3px_rgba(37,99,235,.3)]" : "border-white/80 hover:border-white"}`}
                style={{ left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%` }}
                aria-label={`Face ${i + 1}`}
                aria-pressed={active}
              >
                {active && (
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {referenceFaces.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>References:</span>
          {referenceFaces.map((src, i) => (
            <img key={i} src={src} alt="" className="size-8 rounded-lg border border-line object-cover" />
          ))}
        </div>
      )}

      <AssistantBubble message={message} state={faces.length ? "listening" : "error"} typewriter={false}>
        <div className="flex flex-wrap gap-2">
          {faces.length > 0 && (
            <>
              <Button onClick={() => onConfirm("search")} loading={busy} icon={<ScanFace className="size-4" />} size="lg">
                {mode === "me" ? "Find me" : "Find this person"}
              </Button>
              {referenceFaces.length < 4 && (
                <Button variant="secondary" onClick={() => onConfirm("add")} disabled={busy} icon={<Plus className="size-4" />} size="lg">
                  Add another photo
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={onRetake} icon={<RotateCcw className="size-4" />} size="lg">
            {faces.length ? "Use a different photo" : "Try again"}
          </Button>
        </div>
      </AssistantBubble>
    </div>
  );
}
