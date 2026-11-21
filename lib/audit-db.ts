/** Audit log (searches, consent) and the reference photos searched with, stored in the database. */
import { blobToBytes, db, num, str } from "@/lib/db";
import { env } from "@/lib/env";
import type { AuditRecord } from "@/lib/types";

export async function writeAudit(rec: AuditRecord) {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO audit (id, type, created_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [rec.id, rec.type, rec.createdAt, JSON.stringify(rec)],
  });
}

export async function getAudit(id: string): Promise<AuditRecord | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT data FROM audit WHERE id = ?", args: [id] });
  const data = str(r.rows[0]?.data);
  return data ? (JSON.parse(data) as AuditRecord) : null;
}

export async function updateAudit(id: string, patch: Record<string, unknown>): Promise<AuditRecord | null> {
  const rec = await getAudit(id);
  if (!rec) return null;
  const next = { ...rec, ...patch, updatedAt: new Date().toISOString() } as AuditRecord;
  await writeAudit(next);
  return next;
}

export async function listAudit(limit = 200): Promise<AuditRecord[]> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT data FROM audit ORDER BY created_at DESC LIMIT ?", args: [limit] });
  return r.rows.map((row) => JSON.parse(String(row.data)) as AuditRecord);
}

/** Stores a reference photo, downscaled to ≤1024 px JPEG, under the audit record. */
export async function savePhoto(auditId: string, idx: number, buf: Buffer) {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const c = await db();
  await c.execute({
    sql: "INSERT INTO audit_photos (audit_id, idx, type, data) VALUES (?, ?, ?, ?) ON CONFLICT(audit_id, idx) DO UPDATE SET data = excluded.data, type = excluded.type",
    args: [auditId, idx, "image/jpeg", new Uint8Array(jpeg)],
  });
}

export async function getPhoto(auditId: string, idx: number): Promise<{ buf: Uint8Array; type: string } | null> {
  const c = await db();
  const r = await c.execute({ sql: "SELECT type, data FROM audit_photos WHERE audit_id = ? AND idx = ?", args: [auditId, idx] });
  const row = r.rows[0];
  if (!row) return null;
  return { buf: blobToBytes(row.data), type: String(row.type) };
}

/** Deletes audit entries and photos older than AUDIT_RETENTION_DAYS. */
let lastPrune = 0;
export async function pruneExpired(force = false) {
  const now = Date.now();
  if (!force && now - lastPrune < 6 * 3600 * 1000) return;
  lastPrune = now;
  const cutoff = new Date(now - env.auditRetentionDays * 24 * 3600 * 1000).toISOString();
  const c = await db();
  await c.batch(
    [
      { sql: "DELETE FROM audit_photos WHERE audit_id IN (SELECT id FROM audit WHERE created_at < ?)", args: [cutoff] },
      { sql: "DELETE FROM audit WHERE created_at < ?", args: [cutoff] },
    ],
    "write",
  );
}

export async function auditCount(): Promise<number> {
  const c = await db();
  return num((await c.execute("SELECT COUNT(*) AS n FROM audit")).rows[0]?.n);
}
