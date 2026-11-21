import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getAudit, listAudit, pruneExpired, savePhoto, updateAudit, writeAudit } from "@/lib/audit-db";
import { getEventBySlug } from "@/lib/events";
import { getValidSession } from "@/lib/google-oauth";
import { clientIp, error, json } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";
import { CONSENT_COOKIE, CONSENT_VERSION, type AuditRecord, type SearchMode } from "@/lib/types";

const MAX_PHOTO = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasConsent(req: NextRequest) {
  try {
    const raw = req.cookies.get(CONSENT_COOKIE)?.value;
    if (!raw) return false;
    const c = JSON.parse(raw) as { v?: string; c?: string };
    return c.c === "accepted" && c.v === CONSENT_VERSION;
  } catch {
    return false;
  }
}

/** Creates an audit record for a new search, storing the reference photos. */
export async function POST(req: NextRequest) {
  if (!hasConsent(req)) return error(403, "Please accept the privacy notice before searching.", "consent-required");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Expected multipart form data");
  }
  const photos = form.getAll("photo").filter((p): p is File => p instanceof File);
  if (!photos.length) return error(400, "Missing photo");
  if (photos.length > 5) return error(400, "Too many reference photos (max 5)");
  for (const p of photos) {
    if (!PHOTO_TYPES.has(p.type)) return error(400, "Photos must be JPEG, PNG or WebP");
    if (p.size > MAX_PHOTO) return error(413, "A photo is too large (max 8 MB)");
  }
  let meta: Partial<{ mode: SearchMode; folderId: string; folderName: string; facesDetected: number; selectedFace: number; referencePhotos: number; event: string }> = {};
  try {
    meta = JSON.parse(String(form.get("meta") || "{}"));
  } catch {
    return error(400, "meta must be JSON");
  }
  if (meta.mode !== "me" && meta.mode !== "someone") return error(400, "Invalid mode");
  const event = meta.event ? await getEventBySlug(meta.event) : null;
  const folderId = event ? event.folderId : meta.folderId;
  if (typeof folderId !== "string" || !folderId) return error(400, "Missing folderId");

  const session = await getValidSession();
  const id = `s_${randomBytes(12).toString("hex")}`;
  const rec: AuditRecord = {
    id,
    type: "search",
    createdAt: new Date().toISOString(),
    mode: meta.mode,
    folderId,
    folderName: event ? event.folderName || undefined : typeof meta.folderName === "string" ? meta.folderName.slice(0, 200) : undefined,
    facesDetected: Number(meta.facesDetected) || 0,
    selectedFace: Number(meta.selectedFace) || 0,
    referencePhotos: photos.length,
    user: session?.user ?? null,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    consentVersion: CONSENT_VERSION,
    photos: photos.length,
    eventId: event?.id,
    eventName: event?.name,
    status: "started",
  };
  await writeAudit(rec);
  for (let i = 0; i < photos.length; i++) {
    try {
      await savePhoto(id, i, Buffer.from(await photos[i].arrayBuffer()));
    } catch (e) {
      console.warn("[filomina] could not store reference photo", (e as Error).message);
    }
  }
  void pruneExpired().catch(() => undefined);
  return json({ id });
}

/** Completes a search record with its outcome. */
export async function PATCH(req: NextRequest) {
  let body: { id?: string; status?: string; scanned?: number; foldersScanned?: number; matches?: number; durationMs?: number };
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  if (!body.id) return error(400, "Missing id");
  const rec = await getAudit(body.id);
  if (!rec || rec.type !== "search") return error(404, "Unknown search");
  if (rec.status !== "started") return json({ ok: true });
  const status = ["completed", "cancelled", "error"].includes(body.status || "") ? body.status : "completed";
  await updateAudit(body.id, {
    status,
    scanned: Number(body.scanned) || 0,
    foldersScanned: Number(body.foldersScanned) || 0,
    matches: Number(body.matches) || 0,
    durationMs: Number(body.durationMs) || 0,
  });
  return json({ ok: true });
}

/** Admin: list audit records. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const limit = Math.min(1000, Number(req.nextUrl.searchParams.get("limit")) || 200);
  return json({ records: await listAudit(limit) });
}
