import type { NextRequest } from "next/server";
import { authHeaders, DriveError, getFile, isWithinRoot, resolveAuth, withAuthParam } from "@/lib/drive";
import { error } from "@/lib/http";
import { localFile } from "@/lib/local-drive";

/** Streams the original file (for downloads). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id")?.trim();
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return error(400, "Bad id");
  try {
    const { auth, event } = await resolveAuth({ event: sp.get("event") });
    if (!auth) return error(401, "Sign in required", "auth-required");
    if (event && !(await isWithinRoot(id, event.folderId, auth))) return error(403, "That photo is not part of this event.");
    if (auth.kind === "local") {
      const f = await localFile(id);
      if (!f) return error(404, "Not found");
      return new Response(new Uint8Array(f.buf), {
        headers: { "content-type": f.type, "content-disposition": `attachment; filename="${f.name.replace(/[^\w.\- ]+/g, "_")}"` },
      });
    }
    const meta = await getFile(id, auth);
    const url = withAuthParam(new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`), auth);
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");
    const upstream = await fetch(url, { headers: authHeaders(auth), cache: "no-store" });
    if (!upstream.ok || !upstream.body) return error(upstream.status, "Could not download file");
    const safeName = meta.name.replace(/[^\w.\- ]+/g, "_");
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") || meta.mimeType || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "private, max-age=600",
      },
    });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(502, (e as Error).message);
  }
}
