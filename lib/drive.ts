/** Thin Google Drive v3 REST client (server only). */
import { env } from "./env";
import { getValidSession } from "./google-oauth";
import type { Session } from "./session";
import type { DriveFolder, DriveImage, DriveListResponse, EventRecord } from "./types";
import { eventDriveAuth, getEventBySlug } from "./events";
import { localEnabled, localGetFolder, localList, LOCAL_ROOT_ID } from "./local-drive";

export type DriveAuth = { kind: "key"; key: string } | { kind: "token"; token: string } | { kind: "local" };

export const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const API = "https://www.googleapis.com/drive/v3";

export class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
    public reason?: string,
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  size?: string;
  imageMediaMetadata?: { width?: number; height?: number; time?: string };
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
  driveId?: string;
};

const FILE_FIELDS =
  "id,name,mimeType,parents,modifiedTime,thumbnailLink,webViewLink,size,imageMediaMetadata(width,height,time),shortcutDetails(targetId,targetMimeType),driveId";

export function authHeaders(auth: DriveAuth): HeadersInit {
  return auth.kind === "token" ? { authorization: `Bearer ${auth.token}` } : {};
}

export function withAuthParam(url: URL, auth: DriveAuth) {
  if (auth.kind === "key") url.searchParams.set("key", auth.key);
  return url;
}

async function driveFetch<T>(
  path: string,
  params: Record<string, string>,
  auth: DriveAuth,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("supportsAllDrives", "true");
  withAuthParam(url, auth);
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(auth), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Google Drive responded with ${res.status}`;
    let reason: string | undefined;
    try {
      const j = (await res.json()) as {
        error?: { message?: string; errors?: { reason?: string }[] };
      };
      message = j.error?.message || message;
      reason = j.error?.errors?.[0]?.reason;
    } catch {
      /* ignore */
    }
    throw new DriveError(res.status, message, reason);
  }
  return (await res.json()) as T;
}

/* ── Metadata cache (names, parents, thumbnail links) ───────────── */

type CachedMeta = { meta: DriveFileMeta; at: number };
const metaCache = new Map<string, CachedMeta>();
const META_TTL = 20 * 60 * 1000;

export function rememberMeta(meta: DriveFileMeta) {
  metaCache.set(meta.id, { meta, at: Date.now() });
  if (metaCache.size > 20_000) {
    // crude eviction: drop the oldest third
    const entries = [...metaCache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of entries.slice(0, Math.floor(entries.length / 3))) metaCache.delete(k);
  }
}

export function forgetMeta(id: string) {
  metaCache.delete(id);
}

export async function getFile(id: string, auth: DriveAuth, useCache = true): Promise<DriveFileMeta> {
  if (auth.kind === "local") {
    const f = await localGetFolder(id);
    if (!f) throw new DriveError(404, "Not found");
    return { id: f.id, name: f.name, mimeType: FOLDER_MIME, modifiedTime: f.modifiedTime, parents: id === LOCAL_ROOT_ID ? undefined : [LOCAL_ROOT_ID] };
  }
  if (useCache) {
    const c = metaCache.get(id);
    if (c && Date.now() - c.at < META_TTL) return c.meta;
  }
  const meta = await driveFetch<DriveFileMeta>(`files/${encodeURIComponent(id)}`, { fields: FILE_FIELDS }, auth);
  rememberMeta(meta);
  return meta;
}

/* ── Listing ──────────────────────────────────────────────────────── */

type ListRaw = { nextPageToken?: string; files: DriveFileMeta[] };

export function toImage(f: DriveFileMeta): DriveImage {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime || "",
    webViewLink: f.webViewLink,
    width: f.imageMediaMetadata?.width,
    height: f.imageMediaMetadata?.height,
    size: f.size ? Number(f.size) : undefined,
    takenAt: f.imageMediaMetadata?.time,
  };
}

export async function listChildren(
  folderId: string,
  auth: DriveAuth,
  pageToken?: string,
): Promise<DriveListResponse> {
  if (auth.kind === "local") {
    const res = await localList(folderId);
    if (!res) throw new DriveError(404, "Folder not found");
    return res;
  }
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false and (mimeType = '${FOLDER_MIME}' or mimeType contains 'image/' or mimeType = '${SHORTCUT_MIME}')`;
  const params: Record<string, string> = {
    q,
    pageSize: "1000",
    orderBy: "folder,name_natural",
    includeItemsFromAllDrives: "true",
    fields: `nextPageToken,files(${FILE_FIELDS})`,
  };
  if (pageToken) params.pageToken = pageToken;
  const raw = await driveFetch<ListRaw>("files", params, auth);

  const folders: DriveFolder[] = [];
  const files: DriveImage[] = [];
  for (const f of raw.files) {
    if (f.mimeType === SHORTCUT_MIME) {
      const target = f.shortcutDetails?.targetId;
      const tm = f.shortcutDetails?.targetMimeType || "";
      if (!target) continue;
      if (tm === FOLDER_MIME) folders.push({ id: target, name: f.name, modifiedTime: f.modifiedTime });
      else if (tm.startsWith("image/")) {
        files.push({ ...toImage(f), id: target, mimeType: tm });
      }
      continue;
    }
    rememberMeta(f);
    if (f.mimeType === FOLDER_MIME) folders.push({ id: f.id, name: f.name, modifiedTime: f.modifiedTime });
    else if (f.mimeType.startsWith("image/")) files.push(toImage(f));
  }
  return { folders, files, nextPageToken: raw.nextPageToken };
}

export async function listAllChildren(folderId: string, auth: DriveAuth): Promise<DriveListResponse> {
  const out: DriveListResponse = { folders: [], files: [] };
  let token: string | undefined;
  for (let i = 0; i < 30; i++) {
    const page = await listChildren(folderId, auth, token);
    out.folders.push(...page.folders);
    out.files.push(...page.files);
    token = page.nextPageToken;
    if (!token) break;
  }
  return out;
}

/* ── Auth resolution ──────────────────────────────────────────────── */

export type ResolvedAuth =
  | { auth: DriveAuth; mode: "authed"; session: Session; event: null }
  | { auth: DriveAuth; mode: "public"; session: null; event: null }
  | { auth: DriveAuth; mode: "event"; session: null; event: EventRecord }
  | { auth: null; mode: "none"; session: null; event: null };

/**
 * Picks Drive credentials for a request. With `event`, the event's stored
 * credentials (or the API key) are used and the caller must scope every
 * folder/file to the event's folder (see `isWithinRoot`).
 */
export async function resolveAuth(opts: { event?: string | null } = {}): Promise<ResolvedAuth> {
  if (localEnabled()) {
    if (opts.event) {
      const ev = await getEventBySlug(opts.event);
      if (!ev || !ev.active) throw new DriveError(404, "This event link is not valid.", "event-not-found");
      return { auth: { kind: "local" }, mode: "event", session: null, event: ev };
    }
    return { auth: { kind: "local" }, mode: "public", session: null, event: null };
  }
  if (opts.event) {
    const ev = await getEventBySlug(opts.event);
    if (!ev || !ev.active) throw new DriveError(404, "This event link is not valid.", "event-not-found");
    const auth = await eventDriveAuth(ev);
    if (!auth) throw new DriveError(503, "This server cannot read the event's folder (no API key or Google link).", "event-no-auth");
    return { auth, mode: "event", session: null, event: ev };
  }
  const session = await getValidSession();
  if (session) return { auth: { kind: "token", token: session.tokens.accessToken }, mode: "authed", session, event: null };
  if (env.googleApiKey) return { auth: { kind: "key", key: env.googleApiKey }, mode: "public", session: null, event: null };
  return { auth: null, mode: "none", session: null, event: null };
}

/** True when `id` is `rootId` itself or lives somewhere below it. */
export async function isWithinRoot(id: string, rootId: string, auth: DriveAuth): Promise<boolean> {
  if (id === rootId) return true;
  if (auth.kind === "local") return true; // local ids are paths under the local root
  let current: string | undefined = id;
  for (let depth = 0; current && depth < 30; depth++) {
    const meta: DriveFileMeta = await getFile(current, auth);
    if (meta.id === rootId) return true;
    const parents: string[] | undefined = meta.parents;
    if (parents?.includes(rootId)) return true;
    current = parents?.[0];
  }
  return false;
}

/** Rewrites a Drive thumbnailLink to the requested pixel size. */
export function sizedThumbnail(link: string, size: number) {
  if (/=s\d+(-c)?$/.test(link)) return link.replace(/=s\d+(-c)?$/, `=s${size}`);
  if (/[?&]sz=/.test(link)) return link.replace(/([?&])sz=[^&]*/, `$1sz=s${size}`);
  return `${link}${link.includes("?") ? "&" : "?"}sz=s${size}`;
}
