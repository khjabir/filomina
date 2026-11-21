import type { NextRequest } from "next/server";
import { modelInfo } from "@/lib/face/engine";
import { indexStats } from "@/lib/face/index-db";
import { json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get("root")?.trim() || undefined;
  let stats = { files: 0, faces: 0 };
  try {
    stats = await indexStats(root);
  } catch {
    /* no index yet */
  }
  const model = await modelInfo().catch(() => null);
  return json({ stats, modelsInstalled: Boolean(model), model });
}
