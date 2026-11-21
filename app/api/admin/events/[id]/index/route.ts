import type { NextRequest } from "next/server";
import { DriveError } from "@/lib/drive";
import { eventDriveAuth, getEvent, updateEvent } from "@/lib/events";
import { runIndexRound } from "@/lib/index-run";
import { forgetTree } from "@/lib/face/indexer";
import { error, json } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";
import { localEnabled } from "@/lib/local-drive";

export const maxDuration = 300;

/** Runs one indexing round for the event's folder. The admin UI calls this until `complete`. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const { id } = await ctx.params;
  const ev = await getEvent(id);
  if (!ev) return error(404, "Event not found");
  let body: { fresh?: boolean; budgetMs?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* defaults */
  }
  try {
    const auth = localEnabled() ? ({ kind: "local" } as const) : await eventDriveAuth(ev);
    if (!auth) return error(503, "No way to read this folder (no API key or Google link).", "event-no-auth");
    if (body.fresh) forgetTree(ev.folderId);
    const result = await runIndexRound({ root: ev.folderId, rootName: ev.folderName || ev.name, auth, event: ev, budgetMs: body.budgetMs, fresh: body.fresh, signal: req.signal });
    return json({ result, event: await getEvent(id) });
  } catch (e) {
    const message = (e as Error).message || "Indexing failed";
    await updateEvent(id, { indexStatus: "error", lastError: message });
    if (e instanceof DriveError) return error(e.status, message, e.reason);
    return error(500, message);
  }
}
