import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DriveError, FOLDER_MIME, getFile, type DriveAuth } from "@/lib/drive";
import { getValidSession } from "@/lib/google-oauth";
import { clearSessionCookie } from "@/lib/session";
import { json } from "@/lib/http";
import type { DriveStatus } from "@/lib/types";
import { localEnabled, localGetFolder, LOCAL_ROOT_ID } from "@/lib/local-drive";

/**
 * Probes how the requested folder can be accessed:
 *  - with the signed-in user's token  → "authed"
 *  - anonymously with the API key     → "public"
 *  - neither                          → "auth-required" / "not-found"
 */
export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get("folder")?.trim() || env.rootFolderId;
  const base = { oauthConfigured: env.oauthConfigured, publicConfigured: env.publicConfigured };
  if (localEnabled()) {
    const folder = await localGetFolder(req.nextUrl.searchParams.get("folder")?.startsWith("local") ? req.nextUrl.searchParams.get("folder")! : LOCAL_ROOT_ID);
    return json(
      folder
        ? ({ mode: "public", folder, user: null, message: "Local folder mode", ...base } satisfies DriveStatus)
        : ({ mode: "error", user: null, message: `DRIVE_LOCAL_DIR (${env.localDir}) is not a readable directory.`, ...base } satisfies DriveStatus),
    );
  }

  const session = await getValidSession();
  const user = session?.user ?? null;

  if (!folderId) {
    return json({ mode: "not-configured", user, ...base } satisfies DriveStatus);
  }

  const probe = async (auth: DriveAuth) => {
    const f = await getFile(folderId, auth, false);
    if (f.mimeType !== FOLDER_MIME) throw new DriveError(400, "That link points to a file, not a folder.", "not-a-folder");
    return { id: f.id, name: f.name, modifiedTime: f.modifiedTime };
  };

  if (session) {
    try {
      const folder = await probe({ kind: "token", token: session.tokens.accessToken });
      return json({ mode: "authed", folder, user, ...base } satisfies DriveStatus);
    } catch (e) {
      const status = e instanceof DriveError ? e.status : 500;
      if (status === 401) {
        await clearSessionCookie();
      } else if (status === 404 || status === 403) {
        return json({
          mode: "not-found",
          user,
          message: `${user?.email ?? "Your account"} does not have access to this folder.`,
          ...base,
        } satisfies DriveStatus);
      } else {
        return json({ mode: "error", user, message: (e as Error).message, ...base } satisfies DriveStatus);
      }
    }
  }

  if (env.googleApiKey) {
    try {
      const folder = await probe({ kind: "key", key: env.googleApiKey });
      return json({ mode: "public", folder, user: null, ...base } satisfies DriveStatus);
    } catch (e) {
      const status = e instanceof DriveError ? e.status : 500;
      if (status === 404 || status === 403) {
        return json({
          mode: env.oauthConfigured ? "auth-required" : "not-found",
          user: null,
          message: env.oauthConfigured
            ? "This folder is not public. Sign in with Google to open it."
            : "This folder is not public and Google sign-in is not configured on this server.",
          ...base,
        } satisfies DriveStatus);
      }
      return json({ mode: "error", user: null, message: (e as Error).message, ...base } satisfies DriveStatus);
    }
  }

  return json({
    mode: env.oauthConfigured ? "auth-required" : "error",
    user: null,
    message: env.oauthConfigured
      ? "Sign in with Google to open this folder."
      : "Server is missing GOOGLE_API_KEY and Google OAuth settings. See .env.example.",
    ...base,
  } satisfies DriveStatus);
}
