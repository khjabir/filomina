/**
 * Optional local-folder backend (set DRIVE_LOCAL_DIR). Serves a directory of
 * photos with the same shape as the Google Drive client so the whole app can be
 * tried without Google credentials. Intended for development and testing.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";
import type { DriveFolder, DriveImage, DriveListResponse } from "./types";

export const LOCAL_ROOT_ID = "local-root";
const IMAGE_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};

export const localEnabled = () => Boolean(env.localDir);
const root = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.localDir);

export function toLocalId(rel: string) {
  return rel ? `local-${Buffer.from(rel, "utf8").toString("base64url")}` : LOCAL_ROOT_ID;
}

/** Resolves an id to an absolute path inside the local directory, or null. */
export function fromLocalId(id: string): { abs: string; rel: string } | null {
  if (id === LOCAL_ROOT_ID) return { abs: root(), rel: "" };
  if (!id.startsWith("local-")) return null;
  let rel: string;
  try {
    rel = Buffer.from(id.slice(6), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const abs = path.resolve(/*turbopackIgnore: true*/ root(), rel);
  if (abs !== root() && !abs.startsWith(root() + path.sep)) return null;
  return { abs, rel };
}

export async function localGetFolder(id: string): Promise<DriveFolder | null> {
  const r = fromLocalId(id);
  if (!r) return null;
  try {
    const st = await fs.stat(/*turbopackIgnore: true*/ r.abs);
    if (!st.isDirectory()) return null;
    return { id, name: r.rel ? path.basename(r.abs) : path.basename(root()) || "Local photos", modifiedTime: st.mtime.toISOString() };
  } catch {
    return null;
  }
}

export async function localList(id: string): Promise<DriveListResponse | null> {
  const r = fromLocalId(id);
  if (!r) return null;
  const entries = await fs.readdir(/*turbopackIgnore: true*/ r.abs, { withFileTypes: true }).catch(() => null);
  if (!entries) return null;
  const folders: DriveFolder[] = [];
  const files: DriveImage[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = r.rel ? `${r.rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      folders.push({ id: toLocalId(rel), name: e.name });
      continue;
    }
    const mime = IMAGE_EXT[path.extname(e.name).toLowerCase()];
    if (!mime) continue;
    const st = await fs.stat(path.join(r.abs, e.name)).catch(() => null);
    if (!st) continue;
    files.push({ id: toLocalId(rel), name: e.name, mimeType: mime, modifiedTime: st.mtime.toISOString(), size: st.size });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { folders, files };
}

export function localPath(id: string) {
  const r = fromLocalId(id);
  if (!r) return null;
  const crumbs = [{ id: LOCAL_ROOT_ID, name: path.basename(root()) || "Local photos" }];
  const parts = r.rel ? r.rel.split("/") : [];
  parts.forEach((p, i) => crumbs.push({ id: toLocalId(parts.slice(0, i + 1).join("/")), name: p }));
  return crumbs;
}

export async function localFile(id: string): Promise<{ buf: Buffer; type: string; name: string } | null> {
  const r = fromLocalId(id);
  if (!r) return null;
  const type = IMAGE_EXT[path.extname(r.abs).toLowerCase()];
  if (!type) return null;
  try {
    return { buf: await fs.readFile(/*turbopackIgnore: true*/ r.abs), type, name: path.basename(r.abs) };
  } catch {
    return null;
  }
}
