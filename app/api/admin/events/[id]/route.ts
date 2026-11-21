import type { NextRequest } from "next/server";
import { deleteEvent, getEvent, updateEvent } from "@/lib/events";
import { getValidSession } from "@/lib/google-oauth";
import { error, json } from "@/lib/http";
import { isAdminRequest } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const ev = await getEvent((await ctx.params).id);
  if (!ev) return error(404, "Event not found");
  return json({ event: ev });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const { id } = await ctx.params;
  const ev = await getEvent(id);
  if (!ev) return error(404, "Event not found");
  let body: { name?: string; description?: string | null; active?: boolean; relink?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }
  const patch: Parameters<typeof updateEvent>[1] = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.relink) {
    const session = await getValidSession();
    if (!session?.tokens.refreshToken) return error(409, "Sign in with Google first (sign out and in again if needed).", "relink-needed");
    patch.refreshToken = session.tokens.refreshToken;
    patch.ownerEmail = session.user.email;
    patch.lastError = null;
  }
  await updateEvent(id, patch);
  return json({ event: await getEvent(id) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await isAdminRequest(req.headers.get("x-admin-key")))) return error(401, "Admin key required", "admin-required");
  const { id } = await ctx.params;
  await deleteEvent(id);
  return json({ ok: true });
}
