import type { NextRequest } from "next/server";
import { DriveError, isWithinRoot, resolveAuth } from "@/lib/drive";
import { getImageBytes, THUMB_SIZES } from "@/lib/drive-images";
import { error } from "@/lib/http";

/** Proxies a photo thumbnail so the browser can show it from the same origin. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id")?.trim();
  const size = Number(sp.get("s") || 640);
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return error(400, "Bad id");
  if (!THUMB_SIZES.has(size)) return error(400, "Unsupported size");
  try {
    const { auth, event } = await resolveAuth({ event: sp.get("event") });
    if (!auth) return error(401, "Sign in required", "auth-required");
    if (event && !(await isWithinRoot(id, event.folderId, auth))) return error(403, "That photo is not part of this event.");
    const { buf, type } = await getImageBytes(id, size, auth);
    return new Response(new Uint8Array(buf), { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(502, (e as Error).message);
  }
}
