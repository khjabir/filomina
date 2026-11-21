import type { NextRequest } from "next/server";
import { DriveError, getFile, resolveAuth } from "@/lib/drive";
import { error, json } from "@/lib/http";
import { localPath } from "@/lib/local-drive";
import type { Breadcrumb } from "@/lib/types";

/** Breadcrumb trail from `root` down to `folder` by walking the parent chain. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folder")?.trim();
  if (!folderId) return error(400, "Missing folder");
  try {
    const { auth, event } = await resolveAuth({ event: sp.get("event") });
    if (!auth) return error(401, "Sign in required", "auth-required");
    const rootId = event ? event.folderId : sp.get("root")?.trim();
    if (auth.kind === "local") {
      const p = localPath(folderId);
      if (!p) return error(404, "Folder not found");
      if (event) {
        const i = p.findIndex((c) => c.id === event.folderId);
        return json({ path: i >= 0 ? p.slice(i) : p });
      }
      return json({ path: p });
    }
    const trail: Breadcrumb[] = [];
    let current: string | undefined = folderId;
    try {
      for (let depth = 0; current && depth < 25; depth++) {
        const meta = await getFile(current, auth);
        trail.unshift({ id: meta.id, name: meta.name });
        if (meta.id === rootId) break;
        current = meta.parents?.[0];
      }
    } catch (e) {
      if (!trail.length) throw e;
    }
    if (event && !trail.some((c) => c.id === event.folderId)) return error(403, "That folder is not part of this event.");
    return json({ path: trail });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status, e.message, e.reason);
    return error(500, (e as Error).message);
  }
}
