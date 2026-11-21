/**
 * Database access through libSQL: a local SQLite file in development and
 * self-hosting, or a hosted Turso database (TURSO_DATABASE_URL) on serverless
 * platforms such as Vercel. One schema, one client.
 */
import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

let client: Client | null = null;
let schema: Promise<void> | null = null;

export function rawDb(): Client {
  if (client) return client;
  if (env.databaseUrl) {
    client = createClient({ url: env.databaseUrl, authToken: env.databaseAuthToken || undefined });
  } else {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.dataDir, "index");
    mkdirSync(dir, { recursive: true });
    client = createClient({ url: `file:${path.join(dir, "faces.sqlite")}` });
  }
  return client;
}

/** Returns the client once the schema exists. */
export async function db(): Promise<Client> {
  if (!schema) {
    schema = migrate().catch((e) => {
      schema = null;
      throw e;
    });
  }
  await schema;
  return rawDb();
}

async function migrate() {
  const c = rawDb();
  if (!env.databaseUrl) await c.execute("PRAGMA journal_mode = WAL").catch(() => undefined);
  await c.batch(
    [
      `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        root TEXT NOT NULL,
        m TEXT NOT NULL,
        name TEXT,
        path TEXT,
        folder_id TEXT,
        width INTEGER,
        height INTEGER,
        web_link TEXT,
        faces INTEGER NOT NULL DEFAULT 0,
        model TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS files_root ON files(root)`,
      `CREATE TABLE IF NOT EXISTS faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,
        score REAL NOT NULL,
        size INTEGER NOT NULL,
        emb BLOB NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS faces_file ON faces(file_id)`,
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        folder_id TEXT NOT NULL,
        folder_name TEXT,
        access TEXT NOT NULL,
        drive_auth TEXT,
        owner_email TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        total_files INTEGER NOT NULL DEFAULT 0,
        indexed_files INTEGER NOT NULL DEFAULT 0,
        faces INTEGER NOT NULL DEFAULT 0,
        index_status TEXT NOT NULL DEFAULT 'idle',
        last_error TEXT,
        last_indexed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS audit (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS audit_created ON audit(created_at)`,
      `CREATE TABLE IF NOT EXISTS audit_photos (
        audit_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        type TEXT NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (audit_id, idx)
      )`,
    ],
    "write",
  );
}

export function f32ToBlob(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export function blobToBytes(b: unknown): Uint8Array {
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  if (b instanceof Uint8Array) return b;
  return new Uint8Array(0);
}

export function blobToF32(b: unknown): Float32Array {
  const copy = new Uint8Array(blobToBytes(b)); // aligned copy
  return new Float32Array(copy.buffer, 0, copy.byteLength >> 2);
}

export const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : Number(v ?? 0) || 0);
export const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
