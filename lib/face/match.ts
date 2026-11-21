/** Client-side scoring helpers (cosine similarity space). Isomorphic. */
import type { ModelInfo } from "@/lib/types";

export const DEFAULT_MODEL: ModelInfo = { name: "arcface", thresholds: { strict: 0.5, balanced: 0.4, relaxed: 0.3, floor: 0.2 } };

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** Maps a cosine similarity to a 0..1 confidence: 50 % at the balanced threshold. */
export function confidence(sim: number, model: ModelInfo) {
  const k = 12;
  return 1 / (1 + Math.exp(-k * (sim - model.thresholds.balanced)));
}

export function matchLabel(sim: number, model: ModelInfo): "Strong match" | "Good match" | "Possible match" {
  const t = model.thresholds;
  if (sim >= t.strict) return "Strong match";
  if (sim >= t.balanced) return "Good match";
  return "Possible match";
}

export function strictnessLabel(threshold: number, model: ModelInfo) {
  const t = model.thresholds;
  if (threshold >= (t.strict + t.balanced) / 2) return "Strict – fewer, surer matches";
  if (threshold <= (t.balanced + t.relaxed) / 2) return "Relaxed – more, looser matches";
  return "Balanced";
}
