import type { ModelInfo, NormBox, SearchFileInfo, SearchFileResult } from "@/lib/types";

export type Match = { file: SearchFileInfo; sim: number; box: NormBox; faceIndex: number; size: number };
export type FolderInfo = { id: string; name: string; path: string; files: number; folders: number };
export type Frame = { file: SearchFileInfo; faces: { box: NormBox; match: boolean; sim: number }[] };
export type ScanPhase = "collect" | "index" | "match" | "done" | "cancelled" | "error";

export type ScanState = {
  phase: ScanPhase;
  message: string;
  foldersVisited: number;
  collected: number;
  known: number;
  pending: number;
  indexed: number;
  faces: number;
  matches: Match[];
  folders: FolderInfo[];
  frame: Frame | null;
  etaMs: number | null;
  startedAt: number;
  durationMs: number;
  items: Map<string, SearchFileResult>;
  model: ModelInfo | null;
  error?: string;
};

export function emptyScan(message: string): ScanState {
  return {
    phase: "collect",
    message,
    foldersVisited: 0,
    collected: 0,
    known: 0,
    pending: 0,
    indexed: 0,
    faces: 0,
    matches: [],
    folders: [],
    frame: null,
    etaMs: null,
    startedAt: performance.now(),
    durationMs: 0,
    items: new Map(),
    model: null,
  };
}

export function toMatch(r: SearchFileResult): Match | null {
  if (r.bestIdx < 0) return null;
  const f = r.faces[r.bestIdx];
  return { file: r.file, sim: r.best, box: f.box, faceIndex: r.bestIdx, size: f.size };
}

export function matchesAbove(items: Iterable<SearchFileResult>, threshold: number): Match[] {
  const out: Match[] = [];
  for (const r of items) {
    if (r.best >= threshold) {
      const m = toMatch(r);
      if (m) out.push(m);
    }
  }
  out.sort((a, b) => b.sim - a.sim);
  return out;
}
