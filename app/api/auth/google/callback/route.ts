import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { exchangeCode, fetchUserInfo, OAUTH_COOKIE } from "@/lib/google-oauth";
import { sealSession, SESSION_COOKIE, type Session } from "@/lib/session";

function fail(reason: string) {
  const url = new URL("/", env.appUrl);
  url.searchParams.set("auth_error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  if (sp.get("error")) return fail(sp.get("error")!);
  if (!code || !state) return fail("missing_code");

  let stored: { state?: string; next?: string } = {};
  try {
    stored = JSON.parse(req.cookies.get(OAUTH_COOKIE)?.value || "{}");
  } catch {
    /* ignore */
  }
  if (!stored.state || stored.state !== state) return fail("state_mismatch");

  try {
    const tokens = await exchangeCode(code);
    const user = await fetchUserInfo(tokens.access_token);
    const session: Session = {
      user,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in - 30) * 1000,
        scope: tokens.scope,
      },
    };
    const res = NextResponse.redirect(new URL(stored.next || "/", env.appUrl));
    res.cookies.set(SESSION_COOKIE, await sealSession(session), {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    console.error("[filomina] oauth callback failed", e);
    return fail("exchange_failed");
  }
}
