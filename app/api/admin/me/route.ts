import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getValidSession } from "@/lib/google-oauth";
import { error, json } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";

/** Tells the admin UI whether the visitor is unlocked and which Google account is signed in. */
export async function GET(req: NextRequest) {
  if (!env.auditAdminKey) return error(403, "Admin area is disabled. Set AUDIT_ADMIN_KEY on the server.", "admin-disabled");
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const session = await getValidSession();
  return json({ ok: true, user: session?.user ?? null, canLink: Boolean(session?.tokens.refreshToken), oauthConfigured: env.oauthConfigured, publicConfigured: env.publicConfigured });
}
