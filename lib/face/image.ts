/** Small canvas/image helpers for the browser (capture, downscale, avatars). */
import type { NormBox } from "@/lib/types";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

/** Draws the source scaled so the longest side is at most `max` pixels. */
export function downscale(src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, max = 1280): HTMLCanvasElement {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Crops a face (normalised box, with margin) to a square data URL for avatars. */
export function cropFace(src: HTMLImageElement | HTMLCanvasElement, box: NormBox, size = 96, margin = 0.35): string {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const bw = box.w * sw;
  const bh = box.h * sh;
  const side = Math.max(bw, bh) * (1 + margin * 2);
  const cx = box.x * sw + bw / 2;
  const cy = box.y * sh + bh / 2;
  const s = Math.min(side, sw, sh);
  const sx = Math.max(0, Math.min(sw - s, cx - s / 2));
  const sy = Math.max(0, Math.min(sh - s, cy - s / 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(src, sx, sy, s, s, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}
