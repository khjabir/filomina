#!/usr/bin/env node
/**
 * Uploads the face models from ./models to Vercel Blob so serverless functions
 * can download them at cold start (FACE_MODELS_URL).
 *
 *   BLOB_READ_WRITE_TOKEN=... npm run upload-models            # "l" pack
 *   BLOB_READ_WRITE_TOKEN=... npm run upload-models -- --pack sc
 *
 * Get the token from Vercel → Storage → Blob → ".env.local" tab.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const PACKS = { l: ["det_10g.onnx", "w600k_r50.onnx"], sc: ["det_500m.onnx", "w600k_mbf.onnx"] };
const args = process.argv.slice(2);
const packName = args.includes("--pack") ? args[args.indexOf("--pack") + 1] : "l";
const files = PACKS[packName];
if (!files) {
  console.error(`Unknown pack "${packName}" (use l or sc)`);
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in the Vercel dashboard and copy its token.");
  process.exit(1);
}
const dir = path.resolve(process.cwd(), process.env.FACE_MODELS_DIR || "./models");
let base = null;
for (const name of files) {
  const file = path.join(dir, name);
  if (!existsSync(file)) {
    console.error(`${file} not found – run npm run fetch-models first`);
    process.exit(1);
  }
  process.stdout.write(`  uploading ${name} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)… `);
  const blob = await put(`filomina-models/${name}`, readFileSync(file), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
  console.log("done");
  base = blob.url.slice(0, blob.url.lastIndexOf("/"));
}
console.log(`\nAdd this to your Vercel environment variables:\n\n  FACE_MODELS_URL=${base}\n  FACE_MODEL_PACK=${packName}\n`);
