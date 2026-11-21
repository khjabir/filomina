/**
 * Indexing primitives that fit inside one HTTP request: collect the folder
 * tree, find what is not indexed yet, and analyse photos until a time budget
 * runs out. Callers (search, index runs, event admin) loop until complete, so
 * the same code works on a long-running server and on serverless platforms.
 */
import { env } from "@/lib/env";
import { listAllChildren, type DriveAuth } from "@/lib/drive";
import { getImageBytes } from "@/lib/drive-images";
import type { SearchFileInfo } from "@/lib/types";
import { analyzeImage, decodeImage, type FaceResult } from "./engine";
import { getIndexedFiles, storeFile, type IndexedFace, type IndexedFile } from "./index-db";

export type JobFile = SearchFileInfo;
export type FolderEvent = { id: string; name: string; path: string; files: number; folders: number };
export type Tree = { files: JobFile[]; folders: number; collectedAt: number };

const treeCache = new Map<string, Tree>();
const TREE_TTL = 5 * 60 * 1000;

/** Lists every photo under `root` (nested folders included). Cached briefly per server instance. */
export async function collectTree(root: string, rootName: string, auth: DriveAuth, opts: { fresh?: boolean; onFolder?: (f: FolderEvent) => void } = {}): Promise<Tree> {
  const cached = treeCache.get(root);
  if (cached && !opts.fresh && Date.now() - cached.collectedAt < TREE_TTL) {
    return cached;
  }
  const files: JobFile[] = [];
  let folders = 0;
  const queue: { id: string; name: string; path: string }[] = [{ id: root, name: rootName, path: "" }];
  const seen = new Set([root]);
  const visit = async (folder: { id: string; name: string; path: string }) => {
    const res = await listAllChildren(folder.id, auth);
    folders++;
    for (const f of res.files) files.push({ ...f, path: folder.path, folderId: folder.id });
    for (const sub of res.folders) {
      if (seen.has(sub.id)) continue;
      seen.add(sub.id);
      queue.push({ id: sub.id, name: sub.name, path: folder.path ? `${folder.path} / ${sub.name}` : sub.name });
    }
    opts.onFolder?.({ ...folder, files: res.files.length, folders: res.folders.length });
  };
  let active = 0;
  await new Promise<void>((resolve, reject) => {
    const next = () => {
      while (active < 3 && queue.length) {
        const f = queue.shift()!;
        active++;
        visit(f)
          .then(() => {
            active--;
            next();
          })
          .catch(reject);
      }
      if (!active && !queue.length) resolve();
    };
    next();
  });
  const tree = { files, folders, collectedAt: Date.now() };
  treeCache.set(root, tree);
  return tree;
}

export function forgetTree(root: string) {
  treeCache.delete(root);
}

/** Splits the tree into photos already in the index (same version, same model) and photos still to analyse. */
export async function findPending(files: JobFile[], modelName: string): Promise<{ known: Map<string, IndexedFile>; pending: JobFile[] }> {
  const known = await getIndexedFiles(files.map((f) => f.id));
  const pending: JobFile[] = [];
  for (const f of files) {
    const k = known.get(f.id);
    if (!k || k.m !== f.modifiedTime || k.model !== modelName) {
      known.delete(f.id);
      pending.push(f);
    }
  }
  return { known, pending };
}

export type IndexFilesResult = { processed: number; remaining: number; faces: number; stoppedByBudget: boolean };

const inFlight = new Set<string>();

/**
 * Analyses `files` until done, the budget is spent, or the signal aborts.
 * Each photo is stored as soon as it is analysed, so partial runs are safe.
 */
export async function indexFiles(
  files: JobFile[],
  auth: DriveAuth,
  opts: {
    root: string;
    modelName: string;
    budgetMs: number;
    signal?: AbortSignal;
    onFile?: (file: JobFile, faces: IndexedFace[]) => void;
    onProgress?: (p: { done: number; pending: number; faces: number; etaMs: number | null }) => void;
  },
): Promise<IndexFilesResult> {
  const started = Date.now();
  const queue = files.filter((f) => !inFlight.has(f.id));
  let processed = 0;
  let faces = 0;
  let avgMs = 0;
  let stoppedByBudget = false;
  const concurrency = Math.max(1, env.faceConcurrency);

  const worker = async () => {
    while (queue.length) {
      if (opts.signal?.aborted) return;
      if (Date.now() - started > opts.budgetMs) {
        stoppedByBudget = true;
        return;
      }
      const file = queue.shift()!;
      if (inFlight.has(file.id)) continue;
      inFlight.add(file.id);
      const t0 = Date.now();
      let result: FaceResult[] = [];
      let width: number | undefined;
      let height: number | undefined;
      try {
        const { buf } = await getImageBytes(file.id, 1024, auth);
        const img = await decodeImage(buf, 1024);
        width = img.width;
        height = img.height;
        result = await analyzeImage(img, { tta: false });
      } catch (e) {
        console.warn(`[filomina] could not analyse ${file.name}: ${(e as Error).message}`);
      } finally {
        inFlight.delete(file.id);
      }
      try {
        await storeFile({
          id: file.id,
          root: opts.root,
          m: file.modifiedTime,
          name: file.name,
          path: file.path,
          folderId: file.folderId,
          width,
          height,
          webViewLink: file.webViewLink,
          model: opts.modelName,
          faces: result,
        });
      } catch (e) {
        console.warn(`[filomina] could not store ${file.name}: ${(e as Error).message}`);
        continue;
      }
      processed++;
      faces += result.length;
      const dt = Date.now() - t0;
      avgMs += (dt - avgMs) / Math.min(processed, 20);
      opts.onFile?.({ ...file, width, height }, result.map((f, idx) => ({ idx, box: f.box, score: f.score, size: f.size, emb: f.emb })));
      opts.onProgress?.({ done: processed, pending: queue.length, faces, etaMs: processed >= 2 ? (avgMs * queue.length) / concurrency : null });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { processed, remaining: files.length - processed, faces, stoppedByBudget };
}
