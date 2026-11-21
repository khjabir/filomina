import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { error, json } from "@/lib/http";
import { clearAdminCookie, safeEqual, setAdminCookie } from "@/lib/session";
import { clientIp } from "@/lib/http";

/* a few wrong keys per IP and the endpoint goes quiet for a while */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!env.auditAdminKey) return error(403, "Admin area is disabled. Set AUDIT_ADMIN_KEY on the server.", "admin-disabled");
  const ip = clientIp(req) || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.count >= MAX_ATTEMPTS) return error(429, "Too many attempts. Try again later.");
  let body: { key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  if (!body.key || !safeEqual(body.key, env.auditAdminKey)) {
    const cur = a && a.until > now ? a : { count: 0, until: now + WINDOW_MS };
    attempts.set(ip, { count: cur.count + 1, until: cur.until });
    return error(401, "Wrong key");
  }
  attempts.delete(ip);
  await setAdminCookie();
  return json({ ok: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return json({ ok: true });
}
