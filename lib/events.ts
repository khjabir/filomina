/**
 * Events: a named, shareable link bound to one Drive folder. The folder is
 * indexed once by an administrator; visitors of /e/<slug> search instantly.
 * For private folders the creator's Google refresh token is stored encrypted
 * so the server can read thumbnails and new photos on their behalf.
 */
import { randomBytes } from "node:crypto";
import { db, num, str } from "@/lib/db";
import { env } from "@/lib/env";
import { refreshAccessToken } from "@/lib/google-oauth";
import { openSecret, sealSecret } from "@/lib/session";
import type { EventAccess, EventIndexStatus, EventRecord, PublicEvent } from "@/lib/types";
import type { DriveAuth } from "@/lib/drive";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function makeSlug(len = 12) {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

type Row = Record<string, unknown>;

function toRecord(r: Row): EventRecord {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: str(r.description),
    folderId: String(r.folder_id),
    folderName: str(r.folder_name),
    access: (r.access as EventAccess) === "linked" ? "linked" : "public",
    active: num(r.active) === 1,
    totalFiles: num(r.total_files),
    indexedFiles: num(r.indexed_files),
    faces: num(r.faces),
    indexStatus: (str(r.index_status) as EventIndexStatus) || "idle",
    lastIndexedAt: str(r.last_indexed_at),
    ownerEmail: str(r.owner_email),
    hasAuth: Boolean(r.drive_auth),
    lastError: str(r.last_error),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function toPublic(e: EventRecord): PublicEvent {
  const { id, slug, name, description, folderId, folderName, access, active, totalFiles, indexedFiles, faces, indexStatus, lastIndexedAt } = e;
  return { id, slug, name, description, folderId, folderName, access, active, totalFiles, indexedFiles, faces, indexStatus, lastIndexedAt };
}

export async function listEvents(): Promise<EventRecord[]> {
  const c = await db();
  const r = await c.execute("SELECT * FROM events ORDER BY created_at DESC");
  return r.rows.map((row) => toRecord(row as Row));
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [id] });
  return r.rows[0] ? toRecord(r.rows[0] as Row) : null;
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  if (!/^[a-z0-9]{6,24}$/.test(slug)) return null;
  const c = await db();
  const r = await c.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [slug] });
  return r.rows[0] ? toRecord(r.rows[0] as Row) : null;
}

export async function createEvent(input: {
  name: string;
  description?: string | null;
  folderId: string;
  folderName?: string | null;
  access: EventAccess;
  refreshToken?: string | null;
  ownerEmail?: string | null;
}): Promise<EventRecord> {
  const c = await db();
  const id = `ev_${randomBytes(8).toString("hex")}`;
  const slug = makeSlug();
  const now = new Date().toISOString();
  const driveAuth = input.refreshToken ? await sealSecret({ refreshToken: input.refreshToken }) : null;
  await c.execute({
    sql: `INSERT INTO events (id, slug, name, description, folder_id, folder_name, access, drive_auth, owner_email, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [id, slug, input.name, input.description ?? null, input.folderId, input.folderName ?? null, input.access, driveAuth, input.ownerEmail ?? null, now, now],
  });
  return (await getEvent(id))!;
}

export async function updateEvent(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    active: boolean;
    totalFiles: number;
    indexedFiles: number;
    faces: number;
    indexStatus: EventIndexStatus;
    lastError: string | null;
    lastIndexedAt: string | null;
    folderName: string | null;
    refreshToken: string | null;
    ownerEmail: string | null;
  }>,
) {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const map: Record<string, string> = {
    name: "name",
    description: "description",
    totalFiles: "total_files",
    indexedFiles: "indexed_files",
    faces: "faces",
    indexStatus: "index_status",
    lastError: "last_error",
    lastIndexedAt: "last_indexed_at",
    folderName: "folder_name",
    ownerEmail: "owner_email",
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) {
      sets.push(`${col} = ?`);
      args.push((patch as Record<string, string | number | null>)[k] ?? null);
    }
  }
  if ("active" in patch) {
    sets.push("active = ?");
    args.push(patch.active ? 1 : 0);
  }
  if ("refreshToken" in patch) {
    sets.push("drive_auth = ?");
    args.push(patch.refreshToken ? await sealSecret({ refreshToken: patch.refreshToken }) : null);
    tokenCache.delete(id);
  }
  if (!sets.length) return;
  sets.push("updated_at = ?");
  args.push(new Date().toISOString());
  args.push(id);
  const c = await db();
  await c.execute({ sql: `UPDATE events SET ${sets.join(", ")} WHERE id = ?`, args });
}

export async function deleteEvent(id: string) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM events WHERE id = ?", args: [id] });
  tokenCache.delete(id);
}

/* ── Drive access on behalf of an event ────────────────────────────── */

export class EventAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventAuthError";
  }
}

const tokenCache = new Map<string, { token: string; exp: number }>();

/** Returns Drive credentials for an event: the creator's token (private folders) or the API key. */
export async function eventDriveAuth(ev: EventRecord): Promise<DriveAuth | null> {
  if (ev.hasAuth) {
    const cached = tokenCache.get(ev.id);
    if (cached && cached.exp > Date.now() + 60_000) return { kind: "token", token: cached.token };
    const c = await db();
    const r = await c.execute({ sql: "SELECT drive_auth FROM events WHERE id = ?", args: [ev.id] });
    const sealed = str(r.rows[0]?.drive_auth);
    const secret = sealed ? await openSecret<{ refreshToken: string }>(sealed) : null;
    if (!secret?.refreshToken) throw new EventAuthError("The event's Google link is missing. Re-link it in the admin area.");
    try {
      const t = await refreshAccessToken(secret.refreshToken);
      tokenCache.set(ev.id, { token: t.access_token, exp: Date.now() + (t.expires_in - 30) * 1000 });
      return { kind: "token", token: t.access_token };
    } catch (e) {
      await updateEvent(ev.id, { lastError: `Google access expired: ${(e as Error).message}` });
      throw new EventAuthError("Google access for this event has expired. The organiser needs to re-link it.");
    }
  }
  if (env.googleApiKey) return { kind: "key", key: env.googleApiKey };
  return null;
}
