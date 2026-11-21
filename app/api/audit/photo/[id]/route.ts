import type { NextRequest } from "next/server";
import { getPhoto } from "@/lib/audit-db";
import { error } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return error(400, "Bad id");
  const idx = Math.max(0, Number(req.nextUrl.searchParams.get("i")) || 0);
  const photo = await getPhoto(id, idx);
  if (!photo) return error(404, "Photo not found");
  return new Response(new Uint8Array(photo.buf), { headers: { "content-type": photo.type, "cache-control": "private, no-store" } });
}
