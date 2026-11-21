/** Fetches the bytes of a photo (thumbnail at a given size) from Drive or the local folder. */
import { authHeaders, DriveError, forgetMeta, getFile, sizedThumbnail, withAuthParam, type DriveAuth } from "./drive";
import { localFile } from "./local-drive";

const ALLOWED_HOSTS = /(^|\.)googleusercontent\.com$|(^|\.)googleapis\.com$|(^|\.)google\.com$/;
export const THUMB_SIZES = new Set([160, 320, 512, 640, 800, 1024, 1600]);

export type ImageBytes = { buf: Buffer; type: string };

async function fetchThumb(id: string, size: number, auth: DriveAuth, fresh: boolean): Promise<ImageBytes | null> {
  if (fresh) forgetMeta(id);
  const meta = await getFile(id, auth, !fresh);
  if (!meta.thumbnailLink) return null;
  const url = new URL(sizedThumbnail(meta.thumbnailLink, size));
  if (!ALLOWED_HOSTS.test(url.hostname)) return null;
  const res = await fetch(url, { headers: authHeaders(auth), cache: "no-store" });
  if (!res.ok) return null;
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "image/jpeg" };
}

async function fetchMedia(id: string, auth: DriveAuth): Promise<ImageBytes> {
  const url = withAuthParam(new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`), auth);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url, { headers: authHeaders(auth), cache: "no-store" });
  if (!res.ok) throw new DriveError(res.status, "Could not load image");
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "image/jpeg" };
}

export async function getImageBytes(id: string, size: number, auth: DriveAuth): Promise<ImageBytes> {
  if (auth.kind === "local") {
    const f = await localFile(id);
    if (!f) throw new DriveError(404, "Not found");
    return { buf: f.buf, type: f.type };
  }
  return (await fetchThumb(id, size, auth, false)) ?? (await fetchThumb(id, size, auth, true)) ?? fetchMedia(id, auth);
}
