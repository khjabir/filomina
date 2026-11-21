"use client";

import { AnimatePresence, motion } from "motion/react";
import { Camera, SwitchCamera, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { canvasToBlob, downscale } from "@/lib/face/image";

type Facing = "user" | "environment";

export function CameraCapture({ initialFacing = "user", onCapture, onUploadInstead }: { initialFacing?: Facing; onCapture: (blob: Blob) => void; onUploadInstead: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>(initialFacing);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [canFlip, setCanFlip] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? "This browser does not support camera access." : "The camera needs a secure (https) connection. You can upload a photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setReady(true);
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
        } catch {
          /* ignore */
        }
      } catch (e) {
        const name = (e as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in your browser settings or upload a photo instead."
            : name === "NotFoundError"
              ? "No camera found on this device. Upload a photo instead."
              : "Could not start the camera. Upload a photo instead.",
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !ready) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    const blob = await canvasToBlob(downscale(v, 1280), "image/jpeg", 0.92);
    stop();
    onCapture(blob);
  };

  const mirrored = facing === "user";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover transition-opacity duration-500" style={{ transform: mirrored ? "scaleX(-1)" : undefined, opacity: ready ? 1 : 0 }} />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="text-sm text-white/70">Starting camera…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <Camera className="mx-auto mb-3 size-8 text-white/50" />
              <p className="text-sm text-white/80">{error}</p>
              <Button className="mt-4" variant="secondary" icon={<Upload className="size-4" />} onClick={onUploadInstead}>
                Upload a photo
              </Button>
            </div>
          </div>
        )}
        {ready && (
          <>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <motion.div
                className="h-[62%] w-[72%] rounded-[50%] border-2 border-dashed border-white/80"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ boxShadow: "0 0 0 100vmax rgba(0,0,0,.35)" }}
              />
            </div>
            <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-white drop-shadow">Centre your face in the oval</p>
          </>
        )}
        <AnimatePresence>{flash && <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />}</AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button onClick={onUploadInstead} className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-card hover:bg-surface-2" aria-label="Upload a photo instead">
          <Upload className="size-5" />
        </button>
        <motion.button
          onClick={shoot}
          disabled={!ready}
          whileTap={{ scale: 0.92 }}
          className="relative grid size-18 place-items-center rounded-full border-4 border-line bg-surface shadow-pop disabled:opacity-40"
          aria-label="Take photo"
        >
          <span className="size-14 rounded-full bg-accent" />
        </motion.button>
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          disabled={!canFlip}
          className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-card hover:bg-surface-2 disabled:opacity-30"
          aria-label="Switch camera"
        >
          <SwitchCamera className="size-5" />
        </button>
      </div>
    </div>
  );
}
