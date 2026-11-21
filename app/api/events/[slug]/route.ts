import type { NextRequest } from "next/server";
import { getEventBySlug, toPublic } from "@/lib/events";
import { error, json } from "@/lib/http";

/** Public information about an event (what the /e/<slug> page shows). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ev = await getEventBySlug(slug);
  if (!ev || !ev.active) return error(404, "This event link is not valid.", "event-not-found");
  return json({ event: toPublic(ev) });
}
