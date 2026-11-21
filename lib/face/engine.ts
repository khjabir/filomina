/**
 * Server-side face engine built on ONNX Runtime.
 *   detector:   SCRFD (InsightFace)  – boxes + 5 landmarks, good on small faces
 *   recogniser: ArcFace (InsightFace) – 512-d embeddings, robust to pose/lighting
 * Models live in FACE_MODELS_DIR (default ./models); fetch them with
 * `npm run fetch-models`. Everything here is server-only.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-node";
import type { Sharp } from "sharp";
import { env } from "@/lib/env";
import type { ModelInfo, NormBox } from "@/lib/types";

export type RawImage = { data: Buffer; width: number; height: number };
export type Point = [number, number];
export type Detection = { x1: number; y1: number; x2: number; y2: number; score: number; kps: Point[] };
export type FaceResult = { box: NormBox; score: number; size: number; emb: Float32Array };

export class ModelsMissingError extends Error {
  constructor() {
    super(`Face models not found in ${modelsDir()}${env.faceModelsUrl ? ` or at ${env.faceModelsUrl}` : ""}. Run: npm run fetch-models (or set FACE_MODELS_URL).`);
    this.name = "ModelsMissingError";
  }
}

export function modelsDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.faceModelsDir);
}

export type Pack = { detector: string; recognizer: string; info: ModelInfo };

const RECOGNIZERS: { file: string; info: ModelInfo }[] = [
  { file: "w600k_r50.onnx", info: { name: "arcface-r50", thresholds: { strict: 0.5, balanced: 0.4, relaxed: 0.3, floor: 0.2 } } },
  { file: "w600k_mbf.onnx", info: { name: "arcface-mbf", thresholds: { strict: 0.46, balanced: 0.36, relaxed: 0.27, floor: 0.18 } } },
];
const DETECTORS = ["det_10g.onnx", "det_500m.onnx"];
const PACK_FILES: Record<"l" | "sc", { detector: string; recognizer: string }> = {
  l: { detector: "det_10g.onnx", recognizer: "w600k_r50.onnx" },
  sc: { detector: "det_500m.onnx", recognizer: "w600k_mbf.onnx" },
};

function packFromDir(dir: string): Pack | null {
  const detector = DETECTORS.map((f) => path.join(/*turbopackIgnore: true*/ dir, f)).find((p) => existsSync(/*turbopackIgnore: true*/ p));
  const rec = RECOGNIZERS.find((r) => existsSync(/*turbopackIgnore: true*/ path.join(dir, r.file)));
  if (!detector || !rec) return null;
  return { detector, recognizer: path.join(dir, rec.file), info: rec.info };
}

/** Model files installed next to the app (self-hosting). */
export function findLocalModels(): Pack | null {
  return packFromDir(modelsDir());
}

let packPromise: Promise<Pack | null> | null = null;

/**
 * Resolves the model files: the local models directory first, otherwise they
 * are downloaded once from FACE_MODELS_URL into the OS temp directory (the
 * way to run on serverless hosts, where the bundle cannot hold 180 MB).
 */
export function getModels(): Promise<Pack | null> {
  if (!packPromise) {
    packPromise = resolveModels().then((p) => {
      if (!p) packPromise = null; // try again later (e.g. after fetch-models)
      return p;
    });
    packPromise.catch(() => {
      packPromise = null;
    });
  }
  return packPromise;
}

async function resolveModels(): Promise<Pack | null> {
  const local = findLocalModels();
  if (local) return local;
  if (!env.faceModelsUrl) return null;
  const { tmpdir } = await import("node:os");
  const { mkdir, rename, stat } = await import("node:fs/promises");
  const { createWriteStream } = await import("node:fs");
  const { pipeline } = await import("node:stream/promises");
  const { Readable } = await import("node:stream");
  const dir = path.join(tmpdir(), "filomina-models");
  await mkdir(dir, { recursive: true });
  const files = PACK_FILES[env.faceModelPack];
  for (const name of [files.detector, files.recognizer]) {
    const target = path.join(dir, name);
    const ok = await stat(target).then((s) => s.size > 1_000_000).catch(() => false);
    if (ok) continue;
    const url = `${env.faceModelsUrl}/${name}`;
    const t0 = Date.now();
    console.log(`[filomina] downloading model ${name} from ${url}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Could not download ${url} (${res.status})`);
    const tmp = `${target}.${process.pid}.part`;
    await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(tmp));
    await rename(tmp, target);
    console.log(`[filomina] model ${name} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  return packFromDir(dir);
}

export async function modelInfo(): Promise<ModelInfo | null> {
  return (await getModels())?.info ?? null;
}

/* ── sessions ─────────────────────────────────────────────────────── */

type Ort = typeof import("onnxruntime-node");
let ortMod: Ort | null = null;
let detSession: InferenceSession | null = null;
let recSession: InferenceSession | null = null;
let loading: Promise<void> | null = null;

async function ensureLoaded(): Promise<{ ort: Ort; det: InferenceSession; rec: InferenceSession; pack: Pack }> {
  const pack = await getModels();
  if (!pack) throw new ModelsMissingError();
  if (!loading) {
    loading = (async () => {
      const ort = await import("onnxruntime-node");
      const opts: InferenceSession.SessionOptions = {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
        ...(env.faceThreads ? { intraOpNumThreads: env.faceThreads } : {}),
      };
      detSession = await ort.InferenceSession.create(pack.detector, opts);
      recSession = await ort.InferenceSession.create(pack.recognizer, opts);
      ortMod = ort;
      console.log(`[filomina] face engine ready (${path.basename(pack.detector)} + ${path.basename(pack.recognizer)})`);
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  await loading;
  return { ort: ortMod!, det: detSession!, rec: recSession!, pack };
}

/** Loads the models ahead of time (optional). */
export function warmUp() {
  return ensureLoaded().then(() => true).catch(() => false);
}

/* ── image decoding ───────────────────────────────────────────────── */

async function sharpLib(): Promise<(input?: Buffer, opts?: object) => Sharp> {
  const mod = await import("sharp");
  return mod.default as unknown as (input?: Buffer, opts?: object) => Sharp;
}

/** Decodes any image to packed RGB, auto-rotated by EXIF, longest side ≤ maxSide. */
export async function decodeImage(buf: Buffer, maxSide = 1024): Promise<RawImage> {
  const sharp = await sharpLib();
  const { data, info } = await sharp(buf)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#000000" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`Unexpected channel count ${info.channels}`);
  return { data, width: info.width, height: info.height };
}

/* ── detection (SCRFD) ────────────────────────────────────────────── */

const DET_SIZE = 640;
const DET_STRIDES = [8, 16, 32];
const DET_ANCHORS = 2;
const DET_THRESHOLD = 0.5;
const NMS_IOU = 0.4;

function iou(a: Detection, b: Detection) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

function nms(dets: Detection[], thr: number) {
  dets.sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const d of dets) {
    if (keep.every((k) => iou(k, d) < thr)) keep.push(d);
  }
  return keep;
}

export async function detectFaces(img: RawImage): Promise<Detection[]> {
  const { ort, det } = await ensureLoaded();
  const sharp = await sharpLib();
  const scale = Math.min(DET_SIZE / img.width, DET_SIZE / img.height);
  const rw = Math.max(1, Math.round(img.width * scale));
  const rh = Math.max(1, Math.round(img.height * scale));
  const resized = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .resize(rw, rh, { fit: "fill" })
    .extend({ right: DET_SIZE - rw, bottom: DET_SIZE - rh, background: "#000000" })
    .raw()
    .toBuffer();

  const plane = DET_SIZE * DET_SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (resized[i * 3] - 127.5) / 128;
    input[plane + i] = (resized[i * 3 + 1] - 127.5) / 128;
    input[2 * plane + i] = (resized[i * 3 + 2] - 127.5) / 128;
  }
  const feeds: Record<string, OrtTensor> = { [det.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, DET_SIZE, DET_SIZE]) };
  const out = await det.run(feeds);
  const names = det.outputNames;
  const fmc = DET_STRIDES.length;
  const dets: Detection[] = [];
  for (let idx = 0; idx < fmc; idx++) {
    const stride = DET_STRIDES[idx];
    const scores = out[names[idx]].data as Float32Array;
    const boxes = out[names[idx + fmc]].data as Float32Array;
    const kpss = out[names[idx + fmc * 2]].data as Float32Array;
    const w = Math.floor(DET_SIZE / stride);
    const h = Math.floor(DET_SIZE / stride);
    const count = Math.min(scores.length, w * h * DET_ANCHORS);
    for (let i = 0; i < count; i++) {
      const s = scores[i];
      if (s < DET_THRESHOLD) continue;
      const loc = Math.floor(i / DET_ANCHORS);
      const cx = (loc % w) * stride;
      const cy = Math.floor(loc / w) * stride;
      const kps: Point[] = [];
      for (let j = 0; j < 5; j++) kps.push([(cx + kpss[i * 10 + j * 2] * stride) / scale, (cy + kpss[i * 10 + j * 2 + 1] * stride) / scale]);
      dets.push({
        x1: (cx - boxes[i * 4] * stride) / scale,
        y1: (cy - boxes[i * 4 + 1] * stride) / scale,
        x2: (cx + boxes[i * 4 + 2] * stride) / scale,
        y2: (cy + boxes[i * 4 + 3] * stride) / scale,
        score: s,
        kps,
      });
    }
  }
  return nms(dets, NMS_IOU).map((d) => ({
    ...d,
    x1: Math.max(0, d.x1),
    y1: Math.max(0, d.y1),
    x2: Math.min(img.width, d.x2),
    y2: Math.min(img.height, d.y2),
  }));
}

/* ── alignment + embedding (ArcFace) ──────────────────────────────── */

const ALIGN = 112;
/** Canonical landmark positions for the 112×112 ArcFace crop. */
const TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
  [56.1396, 92.2848],
];

/** Least-squares similarity transform (scale+rotation+translation) mapping src → dst. */
function similarity(src: Point[], dst: Point[]): [number, number, number, number] {
  // unknowns: a, b, tx, ty with  u = a x − b y + tx ,  v = b x + a y + ty
  const A = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const B = [0, 0, 0, 0];
  const add = (row: number[], val: number) => {
    for (let i = 0; i < 4; i++) {
      B[i] += row[i] * val;
      for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j];
    }
  };
  for (let k = 0; k < src.length; k++) {
    const [x, y] = src[k];
    const [u, v] = dst[k];
    add([x, -y, 1, 0], u);
    add([y, x, 0, 1], v);
  }
  // Gaussian elimination
  const M = A.map((r, i) => [...r, B[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let j = c; j < 5; j++) M[c][j] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = c; j < 5; j++) M[r][j] -= f * M[c][j];
    }
  }
  return [M[0][4], M[1][4], M[2][4], M[3][4]];
}

/** Warps the face into a normalised 112×112 CHW float tensor; `flip` mirrors it. */
function alignFace(img: RawImage, kps: Point[], flip: boolean): Float32Array {
  const [a, b, tx, ty] = similarity(kps, TEMPLATE);
  const det = a * a + b * b || 1e-9;
  const plane = ALIGN * ALIGN;
  const out = new Float32Array(3 * plane);
  const { data, width, height } = img;
  for (let v = 0; v < ALIGN; v++) {
    for (let uu = 0; uu < ALIGN; uu++) {
      const u = flip ? ALIGN - 1 - uu : uu;
      const du = u - tx;
      const dv = v - ty;
      const x = (a * du + b * dv) / det;
      const y = (-b * du + a * dv) / det;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      let r = 0;
      let g = 0;
      let bl = 0;
      for (let dy = 0; dy <= 1; dy++) {
        const yy = y0 + dy;
        if (yy < 0 || yy >= height) continue;
        const wy = dy ? fy : 1 - fy;
        for (let dx = 0; dx <= 1; dx++) {
          const xx = x0 + dx;
          if (xx < 0 || xx >= width) continue;
          const wgt = wy * (dx ? fx : 1 - fx);
          const o = (yy * width + xx) * 3;
          r += data[o] * wgt;
          g += data[o + 1] * wgt;
          bl += data[o + 2] * wgt;
        }
      }
      const i = v * ALIGN + uu;
      out[i] = (r - 127.5) / 127.5;
      out[plane + i] = (g - 127.5) / 127.5;
      out[2 * plane + i] = (bl - 127.5) / 127.5;
    }
  }
  return out;
}

function normalize(v: Float32Array) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

/**
 * Embeds one face. With `tta` the mirrored crop is embedded too and the two
 * vectors are averaged, which makes mirrored selfies and slight pose
 * differences match reliably.
 */
export async function embedFace(img: RawImage, kps: Point[], tta: boolean): Promise<Float32Array> {
  const { ort, rec } = await ensureLoaded();
  const run = async (flip: boolean) => {
    const feeds: Record<string, OrtTensor> = { [rec.inputNames[0]]: new ort.Tensor("float32", alignFace(img, kps, flip), [1, 3, ALIGN, ALIGN]) };
    const out = await rec.run(feeds);
    return new Float32Array(out[rec.outputNames[0]].data as Float32Array);
  };
  const e = await run(false);
  if (!tta) return normalize(e);
  const f = await run(true);
  for (let i = 0; i < e.length; i++) e[i] += f[i];
  return normalize(e);
}

/** Detects every face and embeds the ones that are big enough. */
export async function analyzeImage(img: RawImage, opts: { tta: boolean; minPx?: number }): Promise<FaceResult[]> {
  const minPx = opts.minPx ?? env.faceMinPx;
  const dets = await detectFaces(img);
  const faces: FaceResult[] = [];
  for (const d of dets) {
    const w = d.x2 - d.x1;
    const h = d.y2 - d.y1;
    const size = Math.round(Math.max(w, h));
    if (size < minPx) continue;
    const emb = await embedFace(img, d.kps, opts.tta);
    faces.push({ box: { x: d.x1 / img.width, y: d.y1 / img.height, w: w / img.width, h: h / img.height }, score: d.score, size, emb });
  }
  return faces;
}

export function cosine(a: Float32Array, b: Float32Array) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
