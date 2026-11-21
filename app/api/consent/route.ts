import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { getValidSession } from "@/lib/google-oauth";
import { clientIp, error } from "@/lib/http";
import { writeAudit } from "@/lib/audit-db";
import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/types";

/** Records the visitor's cookie/privacy choice and sets the consent cookie. */
export async function POST(req: NextRequest) {
  let body: { choice?: string; version?: string } = {};
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  if (body.choice !== "accepted" && body.choice !== "declined") return error(400, "choice must be accepted|declined");
  const session = await getValidSession();
  const id = `c_${randomBytes(10).toString("hex")}`;
  await writeAudit({
    id,
    type: "consent",
    createdAt: new Date().toISOString(),
    choice: body.choice,
    consentVersion: CONSENT_VERSION,
    user: session?.user ?? null,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  const res = NextResponse.json({ ok: true, version: CONSENT_VERSION });
  res.cookies.set(CONSENT_COOKIE, JSON.stringify({ v: CONSENT_VERSION, c: body.choice, at: Date.now() }), {
    httpOnly: false,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600,
  });
  return res;
}
