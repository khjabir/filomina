/** One budgeted indexing round for a folder tree (used by index runs, event admin and search). */
import type { DriveAuth } from "@/lib/drive";
import { env } from "@/lib/env";
import { updateEvent } from "@/lib/events";
import { getModels } from "@/lib/face/engine";
import { collectTree, findPending, indexFiles, type JobFile } from "@/lib/face/indexer";
import { getIndexedFiles, listIndexedFiles } from "@/lib/face/index-db";
import type { EventRecord, IndexRunResult } from "@/lib/types";

export async function runIndexRound(opts: {
  root: string;
  rootName: string;
  auth: DriveAuth;
  budgetMs?: number;
  fresh?: boolean;
  event?: EventRecord | null;
  signal?: AbortSignal;
  onFile?: Parameters<typeof indexFiles>[2]["onFile"];
  onProgress?: Parameters<typeof indexFiles>[2]["onProgress"];
  onFolder?: (f: { id: string; name: string; path: string; files: number; folders: number }) => void;
  /** called after collection, before analysing, with what is already known */
  onCollected?: (tree: { files: JobFile[]; folders: number }, known: Awaited<ReturnType<typeof findPending>>["known"], pending: JobFile[]) => void | Promise<void>;
  /** serve a fully indexed event from the index alone, without touching Drive */
  fromIndexOnly?: boolean;
}): Promise<IndexRunResult> {
  const started = Date.now();
  const pack = await getModels();
  const budgetMs = Math.min(opts.budgetMs ?? env.requestBudgetMs, env.requestBudgetMs);
  if (opts.fromIndexOnly && opts.event && opts.event.indexStatus === "done" && !opts.fresh) {
    const files = (await listIndexedFiles(opts.root)) as JobFile[];
    const known = await getIndexedFiles(files.map((f) => f.id));
    const folders = new Set(files.map((f) => f.folderId)).size;
    await opts.onCollected?.({ files, folders }, known, []);
    return { total: files.length, known: known.size, processed: 0, pending: 0, faces: 0, folders, complete: true, modelsInstalled: Boolean(pack), durationMs: Date.now() - started };
  }
  const tree = await collectTree(opts.root, opts.rootName, opts.auth, { fresh: opts.fresh, onFolder: opts.onFolder });
  const { known, pending } = await findPending(tree.files, pack?.info.name ?? "");
  await opts.onCollected?.(tree, known, pending);
  let processed = 0;
  let faces = 0;
  if (pack && pending.length) {
    if (opts.event) await updateEvent(opts.event.id, { indexStatus: "running", totalFiles: tree.files.length, indexedFiles: known.size });
    const r = await indexFiles(pending, opts.auth, {
      root: opts.root,
      modelName: pack.info.name,
      budgetMs,
      signal: opts.signal,
      onFile: opts.onFile,
      onProgress: opts.onProgress,
    });
    processed = r.processed;
    faces = r.faces;
  }
  const remaining = pending.length - processed;
  if (opts.event) {
    let totalFaces = opts.event.faces;
    try {
      const { indexStats } = await import("@/lib/face/index-db");
      totalFaces = (await indexStats(opts.root)).faces;
    } catch {
      /* keep previous */
    }
    await updateEvent(opts.event.id, {
      totalFiles: tree.files.length,
      indexedFiles: tree.files.length - remaining,
      faces: totalFaces,
      indexStatus: remaining === 0 ? "done" : "running",
      lastIndexedAt: new Date().toISOString(),
      lastError: pack ? null : "Face models are not installed on the server.",
    });
  }
  return {
    total: tree.files.length,
    known: known.size,
    processed,
    pending: remaining,
    faces,
    folders: tree.folders,
    complete: remaining === 0 && Boolean(pack),
    modelsInstalled: Boolean(pack),
    durationMs: Date.now() - started,
  };
}
