import type { NextRequest } from "next/server";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function error(status: number, message: string, code?: string) {
  return Response.json({ error: message, code: code ?? message }, { status });
}

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

export function isSafeRelativePath(p: string | null | undefined): p is string {
  return Boolean(p && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\"));
}
