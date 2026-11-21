import type { NextRequest } from "next/server";
import { analyzeImage, decodeImage, ModelsMissingError, modelInfo } from "@/lib/face/engine";
import { error, json } from "@/lib/http";
import type { AnalyzeResponse } from "@/lib/types";

export const maxDuration = 120;
const MAX = 12 * 1024 * 1024;

/** Finds the faces in a query photo and returns their embeddings (flip-averaged). */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Expected multipart form data");
  }
  const photo = form.get("photo");
  if (!(photo instanceof File)) return error(400, "Missing photo");
  if (photo.size > MAX) return error(413, "Photo is too large (max 12 MB)");
  try {
    const img = await decodeImage(Buffer.from(await photo.arrayBuffer()), 1280);
    const faces = await analyzeImage(img, { tta: true, minPx: 28 });
    const model = (await modelInfo())!;
    return json({
      width: img.width,
      height: img.height,
      model,
      faces: faces.map((f) => ({ box: f.box, score: f.score, size: f.size, emb: Array.from(f.emb) })),
    } satisfies AnalyzeResponse);
  } catch (e) {
    if (e instanceof ModelsMissingError) return error(503, e.message, "models-missing");
    console.error("[filomina] analyze failed", e);
    return error(500, (e as Error).message || "Could not analyse the photo");
  }
}
