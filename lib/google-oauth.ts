import { env } from "./env";
import {
  clearSessionCookie,
  getSession,
  setSessionCookie,
  type Session,
} from "./session";
import type { SessionUser } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const OAUTH_COOKIE = "filomina_oauth";

export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
];

export function redirectUri() {
  return `${env.appUrl}/api/auth/google/callback`;
}

export function buildAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token endpoint ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string) {
  return tokenRequest({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "refresh_token",
  });
}

export async function fetchUserInfo(accessToken: string): Promise<SessionUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  const j = (await res.json()) as { email?: string; name?: string; picture?: string };
  if (!j.email) throw new Error("Google account has no e-mail address");
  return { email: j.email, name: j.name, picture: j.picture };
}

/**
 * Returns the current session with a usable access token, refreshing it
 * (and re-writing the cookie) when it is about to expire. Route handlers only.
 */
export async function getValidSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const soon = Date.now() + 60_000;
  if (session.tokens.expiresAt > soon) return session;
  if (!session.tokens.refreshToken || !env.oauthConfigured) {
    await clearSessionCookie();
    return null;
  }
  try {
    const t = await refreshAccessToken(session.tokens.refreshToken);
    const next: Session = {
      user: session.user,
      tokens: {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? session.tokens.refreshToken,
        expiresAt: Date.now() + (t.expires_in - 30) * 1000,
        scope: t.scope ?? session.tokens.scope,
      },
    };
    await setSessionCookie(next);
    return next;
  } catch (e) {
    console.warn("[filomina] token refresh failed", e);
    await clearSessionCookie();
    return null;
  }
}
