/** Face index tables (files, faces) on libSQL. */
import { blobToF32, db, f32ToBlob, num, str } from "@/lib/db";
import type { IndexStats, NormBox } from "@/lib/types";
import type { FaceResult } from "./engine";

export type IndexedFace = { idx: number; box: NormBox; score: number; size: number; emb: Float32Array };
export type IndexedFile = { id: string; m: string; model: string; width?: number; height?: number; faces: IndexedFace[] };
export type FileToStore = {
  id: string;
  root: string;
  m: string;
  name: string;
  path: string;
  folderId: string;
  width?: number;
  height?: number;
  webViewLink?: string;
  model: string;
  faces: FaceResult[];
};

/** Returns the indexed files among `ids`, with their faces. */
export async function getIndexedFiles(ids: string[]): Promise<Map<string, IndexedFile>> {
  const c = await db();
  const out = new Map<string, IndexedFile>();
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const marks = chunk.map(() => "?").join(",");
    const files = await c.execute({ sql: `SELECT id, m, model, width, height FROM files WHERE id IN (${marks})`, args: chunk });
    for (const r of files.rows) {
      out.set(String(r.id), { id: String(r.id), m: String(r.m), model: String(r.model), width: r.width === null ? undefined : num(r.width), height: r.height === null ? undefined : num(r.height), faces: [] });
    }
    if (!files.rows.length) continue;
    const faces = await c.execute({ sql: `SELECT file_id, idx, x, y, w, h, score, size, emb FROM faces WHERE file_id IN (${marks}) ORDER BY file_id, idx`, args: chunk });
    for (const r of faces.rows) {
      out.get(String(r.file_id))?.faces.push({ idx: num(r.idx), box: { x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h) }, score: num(r.score), size: num(r.size), emb: blobToF32(r.emb) });
    }
  }
  return out;
}

export async function storeFile(rec: FileToStore) {
  const c = await db();
  const now = new Date().toISOString();
  await c.batch(
    [
      { sql: "DELETE FROM faces WHERE file_id = ?", args: [rec.id] },
      {
        sql: `INSERT INTO files (id, root, m, name, path, folder_id, width, height, web_link, faces, model, indexed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET root=excluded.root, m=excluded.m, name=excluded.name, path=excluded.path, folder_id=excluded.folder_id,
                width=excluded.width, height=excluded.height, web_link=excluded.web_link, faces=excluded.faces, model=excluded.model, indexed_at=excluded.indexed_at`,
        args: [rec.id, rec.root, rec.m, rec.name, rec.path, rec.folderId, rec.width ?? null, rec.height ?? null, rec.webViewLink ?? null, rec.faces.length, rec.model, now],
      },
      ...rec.faces.map((f, idx) => ({
        sql: "INSERT INTO faces (file_id, idx, x, y, w, h, score, size, emb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [rec.id, idx, f.box.x, f.box.y, f.box.w, f.box.h, f.score, f.size, f32ToBlob(f.emb)],
      })),
    ],
    "write",
  );
}

/** The photos indexed under a root, read from the index alone (no Drive calls). */
export async function listIndexedFiles(root: string): Promise<{ id: string; name: string; path: string; folderId: string; modifiedTime: string; webViewLink?: string; width?: number; height?: number }[]> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT id, name, path, folder_id, m, web_link, width, height FROM files WHERE root = ? ORDER BY path, name", args: [root] });
  return r.rows.map((row) => ({
    id: String(row.id),
    name: str(row.name) ?? "",
    path: str(row.path) ?? "",
    folderId: str(row.folder_id) ?? root,
    modifiedTime: String(row.m),
    webViewLink: str(row.web_link) ?? undefined,
    width: row.width === null ? undefined : num(row.width),
    height: row.height === null ? undefined : num(row.height),
  }));
}

export async function indexStats(root?: string): Promise<IndexStats> {
  const c = await db();
  const files = root
    ? await c.execute({ sql: "SELECT COUNT(*) AS n, MAX(indexed_at) AS t FROM files WHERE root = ?", args: [root] })
    : await c.execute("SELECT COUNT(*) AS n, MAX(indexed_at) AS t FROM files");
  const faces = root
    ? await c.execute({ sql: "SELECT COUNT(*) AS n FROM faces WHERE file_id IN (SELECT id FROM files WHERE root = ?)", args: [root] })
    : await c.execute("SELECT COUNT(*) AS n FROM faces");
  return { files: num(files.rows[0]?.n), faces: num(faces.rows[0]?.n), updatedAt: str(files.rows[0]?.t) ?? undefined };
}

export async function deleteFile(id: string) {
  const c = await db();
  await c.batch([{ sql: "DELETE FROM faces WHERE file_id = ?", args: [id] }, { sql: "DELETE FROM files WHERE id = ?", args: [id] }], "write");
}
