#!/usr/bin/env node
/**
 * Downloads the InsightFace model pack Filomina uses for face detection
 * (SCRFD) and recognition (ArcFace) and extracts the two ONNX files into
 * FACE_MODELS_DIR (default ./models).
 *
 *   npm run fetch-models              # "l" pack: det_10g + w600k_r50 (~280 MB download, best accuracy)
 *   npm run fetch-models -- --pack sc # "sc" pack: det_500m + w600k_mbf (~16 MB, for small servers)
 *   npm run fetch-models -- --force   # re-download even if the files exist
 *
 * Licence note: the InsightFace model weights are published for
 * non-commercial research use. Check https://github.com/deepinsight/insightface
 * before using them in a commercial product.
 */
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const PACKS = {
  l: {
    url: "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
    files: ["det_10g.onnx", "w600k_r50.onnx"],
    note: "SCRFD-10GF detector + ArcFace ResNet-50 (recommended)",
  },
  sc: {
    url: "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_sc.zip",
    files: ["det_500m.onnx", "w600k_mbf.onnx"],
    note: "SCRFD-500MF detector + ArcFace MobileFaceNet (light)",
  },
};

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const packName = opt("--pack") || "l";
const pack = PACKS[packName];
if (!pack) {
  console.error(`Unknown pack "${packName}". Use --pack l or --pack sc.`);
  process.exit(1);
}
const dir = path.resolve(process.cwd(), opt("--dir") || process.env.FACE_MODELS_DIR || "./models");
const force = args.includes("--force");

mkdirSync(dir, { recursive: true });
const missing = pack.files.filter((f) => !existsSync(path.join(dir, f)));
if (!missing.length && !force) {
  console.log(`Models already installed in ${dir}:`);
  for (const f of pack.files) console.log(`  ${f}  (${mb(statSync(path.join(dir, f)).size)})`);
  process.exit(0);
}

console.log(`Filomina · downloading ${pack.note}`);
console.log(`  from ${pack.url}`);
console.log(`  into ${dir}\n`);
console.log("  Licence: InsightFace model weights are for non-commercial research use – see the project page for details.\n");

const res = await fetch(pack.url, { redirect: "follow" });
if (!res.ok || !res.body) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const total = Number(res.headers.get("content-length")) || 0;
const chunks = [];
let got = 0;
let lastPct = -1;
for await (const chunk of res.body) {
  chunks.push(chunk);
  got += chunk.length;
  if (total) {
    const pct = Math.floor((got / total) * 20) * 5;
    if (pct !== lastPct) {
      lastPct = pct;
      process.stdout.write(`\r  downloading… ${pct}% (${mb(got)} of ${mb(total)})`);
    }
  } else process.stdout.write(`\r  downloading… ${mb(got)}`);
}
process.stdout.write("\n");
const zip = Buffer.concat(chunks);

const entries = readZip(zip);
for (const name of pack.files) {
  const entry = entries.find((e) => e.name === name || e.name.endsWith(`/${name}`));
  if (!entry) {
    console.error(`  ${name}: not found in the archive`);
    process.exit(1);
  }
  const data = entry.method === 8 ? inflateRawSync(entry.data) : entry.data;
  writeFileSync(path.join(dir, name), data);
  console.log(`  ✓ ${name} (${mb(data.length)})`);
}
const tmp = path.join(dir, ".download.zip");
if (existsSync(tmp)) rmSync(tmp, { force: true });
console.log(`\nDone. Restart the app (npm run dev / npm start) to load the models.`);

function mb(n) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Minimal ZIP reader (no ZIP64) – enough for the InsightFace packs. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lnameLen = buf.readUInt16LE(local + 26);
    const lextraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lnameLen + lextraLen;
    out.push({ name, method, data: buf.subarray(start, start + csize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
