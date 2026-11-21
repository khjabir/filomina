import { json } from "@/lib/http";
import { indexStats } from "@/lib/face/index-db";
import { modelInfo } from "@/lib/face/engine";

export async function GET() {
  const model = await modelInfo().catch(() => null);
  try {
    return json({ ...(await indexStats()), model });
  } catch (e) {
    return json({ files: 0, faces: 0, model, error: (e as Error).message });
  }
}
