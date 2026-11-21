import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DriveError, FOLDER_MIME, getFile, type DriveAuth } from "@/lib/drive";
import { extractDriveId } from "@/lib/drive-id";
import { createEvent, listEvents } from "@/lib/events";
import { getValidSession } from "@/lib/google-oauth";
import { localEnabled, localGetFolder, LOCAL_ROOT_ID } from "@/lib/local-drive";
import { error, json } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  return json({ events: await listEvents() });
}

/**
 * Creates an event. Public folders are read with the API key; private folders
 * need the admin to be signed in with Google, and the account's refresh token
 * is stored (encrypted) with the event so visitors never have to sign in.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  let body: { name?: string; description?: string; folder?: string } = {};
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  const name = body.name?.trim();
  if (!name) return error(400, "Give the event a name");
  const folderId = localEnabled() ? (body.folder?.trim() ? extractDriveId(body.folder) || LOCAL_ROOT_ID : LOCAL_ROOT_ID) : extractDriveId(body.folder || "");
  if (!folderId) return error(400, "That doesn't look like a Google Drive folder link");

  if (localEnabled()) {
    const f = await localGetFolder(folderId);
    if (!f) return error(404, "Local folder not found");
    const ev = await createEvent({ name, description: body.description?.trim() || null, folderId, folderName: f.name, access: "public" });
    return json({ event: ev }, { status: 201 });
  }

  const probe = async (auth: DriveAuth) => {
    const f = await getFile(folderId, auth, false);
    if (f.mimeType !== FOLDER_MIME) throw new DriveError(400, "That link points to a file, not a folder.", "not-a-folder");
    return f.name;
  };

  // 1. public folder?
  if (env.googleApiKey) {
    try {
      const folderName = await probe({ kind: "key", key: env.googleApiKey });
      const ev = await createEvent({ name, description: body.description?.trim() || null, folderId, folderName, access: "public" });
      return json({ event: ev }, { status: 201 });
    } catch (e) {
      if (!(e instanceof DriveError) || (e.status !== 403 && e.status !== 404)) return error(502, (e as Error).message);
    }
  }
  // 2. private folder: use the signed-in admin's Google account
  const session = await getValidSession();
  if (!session) return error(409, "This folder is not public. Sign in with Google (menu) with an account that can see it, then try again.", "sign-in-needed");
  if (!session.tokens.refreshToken) return error(409, "Your Google session has no refresh token. Sign out and sign in again, then try again.", "relink-needed");
  try {
    const folderName = await probe({ kind: "token", token: session.tokens.accessToken });
    const ev = await createEvent({
      name,
      description: body.description?.trim() || null,
      folderId,
      folderName,
      access: "linked",
      refreshToken: session.tokens.refreshToken,
      ownerEmail: session.user.email,
    });
    return json({ event: ev }, { status: 201 });
  } catch (e) {
    if (e instanceof DriveError) return error(e.status === 404 ? 404 : e.status, e.status === 404 ? `${session.user.email} cannot see this folder.` : e.message, e.reason);
    return error(502, (e as Error).message);
  }
}
