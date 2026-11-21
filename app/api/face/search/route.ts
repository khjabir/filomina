import type { NextRequest } from "next/server";
import { DriveError, resolveAuth } from "@/lib/drive";
import { cosine, getModels } from "@/lib/face/engine";
import type { IndexedFace } from "@/lib/face/index-db";
import type { JobFile } from "@/lib/face/indexer";
import { runIndexRound } from "@/lib/index-run";
import { error } from "@/lib/http";
import type { SearchEvent, SearchFace, SearchFileResult } from "@/lib/types";

export const maxDuration = 300;

type Body = { root?: string; rootName?: string; event?: string; refs?: number[][] };

/**
 * Streams search progress and results as server-sent events. Photos already in
 * the index are scored instantly; the rest are analysed on the fly within the
 * request's time budget. The final `done` event says whether everything was
 * covered; if not, the client simply calls again to continue.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return error(400, "Invalid JSON");
  }
  const refs = (body.refs ?? []).filter((r) => Array.isArray(r) && r.length >= 128).map((r) => Float32Array.from(r));
  if (!refs.length) return error(400, "Missing reference embeddings");
  const pack = await getModels();
  if (!pack) return error(503, "Face models are not installed on the server. Run: npm run fetch-models", "models-missing");

  let resolved;
  try {
    resolved = await resolveAuth({ event: body.event });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(500, (e as Error).message);
  }
  if (!resolved.auth) return error(401, "Sign in required", "auth-required");
  const root = resolved.event ? resolved.event.folderId : body.root?.trim();
  const rootName = resolved.event ? resolved.event.folderName || resolved.event.name : body.rootName || "folder";
  if (!root) return error(400, "Missing root");
  const { auth, event } = resolved;

  const encoder = new TextEncoder();
  const started = performance.now();

  const score = (file: JobFile, faces: IndexedFace[], fresh: boolean): SearchFileResult => {
    let best = -1;
    let bestIdx = -1;
    const out: SearchFace[] = faces.map((f, i) => {
      let sim = -1;
      for (const r of refs) sim = Math.max(sim, cosine(r, f.emb));
      if (sim > best) {
        best = sim;
        bestIdx = i;
      }
      return { box: f.box, score: f.score, size: f.size, sim };
    });
    return { file, faces: out, best, bestIdx, fresh };
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let totalFaces = 0;
      const send = (e: SearchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      req.signal.addEventListener("abort", close);
      try {
        send({ type: "phase", phase: "collect" });
        const result = await runIndexRound({
          root,
          rootName,
          auth,
          event,
          fromIndexOnly: true,
          signal: req.signal,
          onFolder: (f) => send({ type: "folder", ...f }),
          onCollected: (tree, known, pending) => {
            send({ type: "collected", total: tree.files.length, known: known.size, pending: pending.length, folders: tree.folders });
            send({ type: "phase", phase: pending.length ? "index" : "match" });
            let batch: SearchFileResult[] = [];
            for (const f of tree.files) {
              const k = known.get(f.id);
              if (!k) continue;
              totalFaces += k.faces.length;
              batch.push(score({ ...f, width: k.width ?? f.width, height: k.height ?? f.height }, k.faces, false));
              if (batch.length >= 200) {
                send({ type: "files", items: batch });
                batch = [];
              }
            }
            if (batch.length) send({ type: "files", items: batch });
          },
          onFile: (file, faces) => {
            totalFaces += faces.length;
            send({ type: "file", item: score(file, faces, true) });
          },
          onProgress: (p) => send({ type: "progress", done: p.done, pending: p.pending, faces: p.faces, etaMs: p.etaMs }),
        });
        send({ type: "done", durationMs: Math.round(performance.now() - started), model: pack.info, faces: totalFaces, complete: result.complete, pending: result.pending });
      } catch (e) {
        send({ type: "error", message: (e as Error).message || "Search failed" });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
