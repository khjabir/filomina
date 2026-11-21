"use client";

import { motion } from "motion/react";
import { Camera, ImagePlus } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";

export function UploadPicker({ onPick, onCameraInstead, cameraLabel = "Use the camera instead" }: { onPick: (file: File) => void; onCameraInstead?: () => void; cameraLabel?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    onPick(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <motion.button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        whileTap={{ scale: 0.99 }}
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-surface p-6 text-center transition ${over ? "border-accent bg-accent-soft" : "border-line hover:border-accent/60"}`}
      >
        <span className="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent">
          <ImagePlus className="size-7" />
        </span>
        <span className="text-base font-semibold">Choose a photo</span>
        <span className="text-sm text-muted">Tap to pick from your device, or drop an image here. A clear, front-facing photo works best.</span>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      </motion.button>
      {onCameraInstead && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" icon={<Camera className="size-4" />} onClick={onCameraInstead}>
            {cameraLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
