import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { buildAuthUrl, OAUTH_COOKIE } from "@/lib/google-oauth";
import { error, isSafeRelativePath } from "@/lib/http";



export async function GET(req: NextRequest) {
  if (!env.oauthConfigured) return error(500, "Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  const next = req.nextUrl.searchParams.get("next");
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, next: isSafeRelativePath(next) ? next : "/" }), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
