import type { NextRequest } from "next/server";
import { DriveError, resolveAuth } from "@/lib/drive";
import { runIndexRound } from "@/lib/index-run";
import { error, json } from "@/lib/http";

export const maxDuration = 300;

/** Runs one indexing round for a folder tree. Call again until `complete` is true. */
export async function POST(req: NextRequest) {
  let body: { root?: string; rootName?: string; event?: string; budgetMs?: number; fresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  let resolved;
  try {
    resolved = await resolveAuth({ event: body.event });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(500, (e as Error).message);
  }
  if (!resolved.auth) return error(401, "Sign in required", "auth-required");
  const root = resolved.event ? resolved.event.folderId : body.root?.trim();
  if (!root) return error(400, "Missing root");
  try {
    const result = await runIndexRound({
      root,
      rootName: resolved.event ? resolved.event.folderName || resolved.event.name : body.rootName || "folder",
      auth: resolved.auth,
      event: resolved.event,
      budgetMs: body.budgetMs,
      fresh: body.fresh,
      signal: req.signal,
    });
    return json(result);
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(500, (e as Error).message || "Indexing failed");
  }
}
