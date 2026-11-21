import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "filomina_session";
export const ADMIN_COOKIE = "filomina_admin";
const SESSION_DAYS = 30;

export type Session = {
  user: SessionUser;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    /** epoch milliseconds */
    expiresAt: number;
    scope?: string;
  };
};

let cachedKey: Uint8Array | null = null;
let warned = false;

function secret() {
  if (env.sessionSecret) return env.sessionSecret;
  // The fallback below is public (it is in the source code), so it must never protect real data.
  if (env.isProd) {
    throw new Error("SESSION_SECRET is not set. It encrypts sign-in sessions and stored Google tokens; generate one with: openssl rand -base64 32");
  }
  if (!warned) {
    warned = true;
    console.warn("[filomina] SESSION_SECRET is not set – using an insecure development fallback. Set it in .env.local.");
  }
  return "filomina-dev-insecure-secret-change-me";
}

function key() {
  if (!cachedKey) {
    cachedKey = new Uint8Array(createHash("sha256").update(secret()).digest());
  }
  return cachedKey;
}

export async function sealSession(session: Session): Promise<string> {
  return new EncryptJWT({ s: session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .encrypt(key());
}

export async function openSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, key());
    const s = payload.s as Session | undefined;
    if (!s || !s.user?.email || !s.tokens?.accessToken) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return openSession(raw);
}

export async function setSessionCookie(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await sealSession(session), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ── Generic secrets at rest (e.g. an event's Drive refresh token) ── */

export async function sealSecret(value: unknown): Promise<string> {
  return new EncryptJWT({ v: value }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().encrypt(key());
}

export async function openSecret<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, key());
    return (payload.v as T) ?? null;
  } catch {
    return null;
  }
}

/* ── Audit admin cookie ───────────────────────────────────────────── */

export function adminToken(): string {
  return createHmac("sha256", secret()).update("filomina-admin").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function isAdminRequest(headerKey?: string | null): Promise<boolean> {
  if (!env.auditAdminKey) return false;
  if (headerKey && safeEqual(headerKey, env.auditAdminKey)) return true;
  const store = await cookies();
  const c = store.get(ADMIN_COOKIE)?.value;
  return Boolean(c && safeEqual(c, adminToken()));
}

export async function setAdminCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 3600,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
