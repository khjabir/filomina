import type { NextRequest } from "next/server";
import { DriveError, isWithinRoot, listAllChildren, listChildren, resolveAuth } from "@/lib/drive";
import { error, json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folder")?.trim();
  if (!folderId) return error(400, "Missing folder");
  try {
    const { auth, event } = await resolveAuth({ event: sp.get("event") });
    if (!auth) return error(401, "Sign in required", "auth-required");
    if (event && !(await isWithinRoot(folderId, event.folderId, auth))) return error(403, "That folder is not part of this event.");
    const data = sp.get("all") === "1" ? await listAllChildren(folderId, auth) : await listChildren(folderId, auth, sp.get("pageToken") || undefined);
    return json(data);
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(500, (e as Error).message);
  }
}
