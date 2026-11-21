#!/usr/bin/env node
/**
 * Filomina · environment check
 * Reads .env.local (and the process environment), validates every setting the
 * app uses, and probes Google Drive when enough is configured to do so.
 *
 *   npm run check-env            validate + probe
 *   npm run check-env -- --no-probe
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envFile = path.join(root, ".env.local");
const noProbe = process.argv.includes("--no-probe");

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const get = (k) => (process.env[k] ?? fileEnv[k] ?? "").trim();

const c = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let fails = 0;
let warns = 0;
const ok = (m) => console.log(`  ${c.g}✓${c.x} ${m}`);
const warn = (m, hint) => {
  warns++;
  console.log(`  ${c.y}!${c.x} ${m}${hint ? `\n    ${c.d}→ ${hint}${c.x}` : ""}`);
};
const fail = (m, hint) => {
  fails++;
  console.log(`  ${c.r}✗${c.x} ${m}${hint ? `\n    ${c.d}→ ${hint}${c.x}` : ""}`);
};
const section = (t) => console.log(`\n${c.b}${t}${c.x}`);

console.log(`\n${c.b}Filomina · environment check${c.x} ${c.d}(${existsSync(envFile) ? ".env.local" : "no .env.local found – copy .env.example to .env.local"})${c.x}`);

/* ── core ──────────────────────────────────────────────────────────── */
section("Core");
const secret = get("SESSION_SECRET");
if (!secret) fail("SESSION_SECRET is empty", "generate one:  openssl rand -base64 32");
else if (secret.length < 32) warn("SESSION_SECRET is short (< 32 characters)", "use:  openssl rand -base64 32");
else ok("SESSION_SECRET set");

const appUrl = get("APP_URL") || "http://localhost:3000";
let appOrigin = null;
try {
  const u = new URL(appUrl);
  appOrigin = u.origin;
  if (u.pathname !== "/" || appUrl.endsWith("/")) warn(`APP_URL should be just the origin (got ${appUrl})`, `use ${u.origin}`);
  else ok(`APP_URL = ${appUrl}`);
  if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname)) warn("APP_URL is http on a non-local host", "the camera only works on https (or localhost)");
} catch {
  fail(`APP_URL is not a valid URL (${appUrl})`, "example: http://localhost:3000");
}
ok(`NEXT_PUBLIC_APP_NAME = ${get("NEXT_PUBLIC_APP_NAME") || "Filomina (default)"}`);

/* ── Drive access ──────────────────────────────────────────────────── */
section("Google Drive access");
const apiKey = get("GOOGLE_API_KEY");
const clientId = get("GOOGLE_CLIENT_ID");
const clientSecret = get("GOOGLE_CLIENT_SECRET");
let folder = get("DRIVE_ROOT_FOLDER_ID");
const localDir = get("DRIVE_LOCAL_DIR");

if (/^https?:\/\//.test(folder)) {
  const m = folder.match(/\/folders\/([a-zA-Z0-9_-]{10,})/) || folder.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) {
    fail(`DRIVE_ROOT_FOLDER_ID is a link, not an ID`, `use only the ID part:  DRIVE_ROOT_FOLDER_ID=${m[1]}`);
    folder = m[1];
  } else fail("DRIVE_ROOT_FOLDER_ID is a link I cannot parse", "open the folder in Drive and copy the part after /folders/");
} else if (folder && !/^[a-zA-Z0-9_-]{10,}$/.test(folder)) fail("DRIVE_ROOT_FOLDER_ID does not look like a Drive ID");
else if (folder) ok(`DRIVE_ROOT_FOLDER_ID = ${folder}`);
else warn("DRIVE_ROOT_FOLDER_ID is empty", "fine – visitors will be asked to paste a folder link. Set it to open a fixed folder by default.");

const publicMode = Boolean(apiKey);
const oauthMode = Boolean(clientId && clientSecret);

if (apiKey) {
  if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(apiKey)) warn("GOOGLE_API_KEY does not look like a Google API key (they start with AIza…)");
  else ok("GOOGLE_API_KEY set → public folders open without sign-in");
} else console.log(`  ${c.d}· GOOGLE_API_KEY not set – public folders will require Google sign-in${c.x}`);

if (clientId || clientSecret) {
  if (!clientId) fail("GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is empty");
  else if (!clientSecret) fail("GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is empty");
  else {
    if (!clientId.endsWith(".apps.googleusercontent.com")) warn("GOOGLE_CLIENT_ID does not end with .apps.googleusercontent.com – is it the OAuth client ID?");
    else ok("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET set → private folders via Google sign-in");
    if (appOrigin) {
      console.log(`  ${c.d}· In the OAuth client, the authorised redirect URI must be exactly:${c.x}`);
      console.log(`    ${c.b}${appOrigin}/api/auth/google/callback${c.x}`);
    }
  }
} else console.log(`  ${c.d}· OAuth not set – private folders cannot be opened${c.x}`);

if (localDir) {
  const abs = path.resolve(root, localDir);
  if (existsSync(abs) && statSync(abs).isDirectory()) ok(`DRIVE_LOCAL_DIR = ${abs} (local test mode – Google settings are ignored while this is set)`);
  else fail(`DRIVE_LOCAL_DIR is not a directory: ${abs}`);
}

if (!publicMode && !oauthMode && !localDir) {
  fail(
    "No way to read photos is configured",
    "set GOOGLE_API_KEY (public folders), GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (sign-in), or DRIVE_LOCAL_DIR (local test). See SETUP.md.",
  );
}

/* ── audit & privacy ───────────────────────────────────────────────── */
section("Audit log & privacy policy");
if (get("AUDIT_ADMIN_KEY")) ok("AUDIT_ADMIN_KEY set → /audit viewer enabled");
else warn("AUDIT_ADMIN_KEY is empty → the /audit viewer is disabled", "generate one:  openssl rand -hex 16");
const days = Number(get("AUDIT_RETENTION_DAYS") || 90);
if (!Number.isFinite(days) || days <= 0) fail("AUDIT_RETENTION_DAYS must be a positive number");
else ok(`AUDIT_RETENTION_DAYS = ${days}`);
const dataDir = path.resolve(root, get("DATA_DIR") || "./data");
ok(`DATA_DIR = ${dataDir}${existsSync(dataDir) ? "" : " (will be created on first use)"}`);
if (get("APP_OPERATOR_NAME")) ok(`APP_OPERATOR_NAME = ${get("APP_OPERATOR_NAME")}`);
else warn("APP_OPERATOR_NAME is empty", "shown in the privacy policy as the party responsible for the data");
const email = get("PRIVACY_CONTACT_EMAIL");
if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ok(`PRIVACY_CONTACT_EMAIL = ${email}`);
else if (email) fail("PRIVACY_CONTACT_EMAIL is not a valid e-mail address");
else warn("PRIVACY_CONTACT_EMAIL is empty", "the privacy policy needs a contact for data requests");

/* ── face models ───────────────────────────────────────────────────── */
section("Face models (server-side)");
const major = Number(process.versions.node.split(".")[0]);
const minor = Number(process.versions.node.split(".")[1]);
if (major > 22 || (major === 22 && minor >= 13)) ok(`Node.js ${process.versions.node}`);
else fail(`Node.js ${process.versions.node} is too old`, "the face index uses node:sqlite – install Node.js 22.13 or newer");
const modelsDir = path.resolve(root, get("FACE_MODELS_DIR") || "./models");
const detector = ["det_10g.onnx", "det_500m.onnx"].find((f) => existsSync(path.join(modelsDir, f)));
const recognizer = ["w600k_r50.onnx", "w600k_mbf.onnx"].find((f) => existsSync(path.join(modelsDir, f)));
if (detector && recognizer) ok(`models installed in ${modelsDir} (${detector} + ${recognizer})`);
else fail(`face models not found in ${modelsDir}`, "run:  npm run fetch-models   (downloads ~280 MB once; add --pack sc for a 16 MB pack)");
const conc = Number(get("FACE_INDEX_CONCURRENCY") || 2);
if (!Number.isFinite(conc) || conc < 1) fail("FACE_INDEX_CONCURRENCY must be ≥ 1");
else ok(`FACE_INDEX_CONCURRENCY = ${conc}`);

/* ── hosting ───────────────────────────────────────────────────────── */
section("Hosting");
const turso = get("TURSO_DATABASE_URL") || get("DATABASE_URL");
const modelsUrl = get("FACE_MODELS_URL");
if (turso) {
  if (!/^(libsql|https?|wss?):\/\//.test(turso)) fail("TURSO_DATABASE_URL does not look like a libsql:// or https:// URL");
  else if (!get("TURSO_AUTH_TOKEN") && !get("DATABASE_AUTH_TOKEN")) warn("TURSO_AUTH_TOKEN is empty", "needed for Turso databases");
  else ok("hosted database configured (Turso/libSQL)");
} else ok("database: local SQLite file under DATA_DIR (fine for self-hosting; use Turso on Vercel)");
if (modelsUrl) {
  if (!/^https?:\/\//.test(modelsUrl)) fail("FACE_MODELS_URL must be an http(s) URL");
  else ok(`FACE_MODELS_URL = ${modelsUrl} (pack ${get("FACE_MODEL_PACK") || "l"})`);
} else if (!detector || !recognizer) warn("FACE_MODELS_URL is empty", "on Vercel the models must be downloadable: npm run upload-models");
const budget = Number(get("FACE_REQUEST_BUDGET_MS") || 240000);
if (budget > 290_000) warn(`FACE_REQUEST_BUDGET_MS = ${budget} exceeds Vercel's 300 s function limit`, "use 240000 on Vercel Hobby, up to 780000 on Pro");
else ok(`FACE_REQUEST_BUDGET_MS = ${budget}`);

/* ── live probe ────────────────────────────────────────────────────── */
async function probe() {
  if (noProbe || localDir) return;
  section("Live check against Google");
  if (!apiKey) {
    console.log(`  ${c.d}· Skipped – nothing can be verified without an API key (OAuth is verified in the browser on first sign-in).${c.x}`);
    return;
  }
  if (!folder) {
    console.log(`  ${c.d}· Set DRIVE_ROOT_FOLDER_ID (or pass --folder <id>) to test the key against a public folder.${c.x}`);
    return;
  }
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folder)}`);
  url.searchParams.set("fields", "id,name,mimeType");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("key", apiKey);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    fail(`Could not reach Google (${e.message})`);
    return;
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    if (body.mimeType === "application/vnd.google-apps.folder") ok(`Folder “${body.name}” is public and readable with the API key 🎉`);
    else fail(`${body.name} is a file, not a folder`, "use the ID of the folder that contains the photos");
    return;
  }
  const msg = body?.error?.message || res.statusText;
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || "";
  if (res.status === 404) {
    fail("Google says the folder is not found (404)", "the ID is wrong, or the folder is not shared as “Anyone with the link”. Share → General access → Anyone with the link → Viewer.");
  } else if (res.status === 403 && /disabled|not been used|accessNotConfigured/i.test(msg + reason)) {
    fail("The Google Drive API is not enabled for this project (403)", "Cloud Console → APIs & Services → Library → Google Drive API → Enable, then wait a minute.");
  } else if (res.status === 403) {
    fail(`Google refused the key (403: ${msg})`, "check the key's API restrictions (allow Google Drive API) and application restrictions (none, or your server's IP).");
  } else if (res.status === 400 && /API key not valid/i.test(msg)) {
    fail("Google says the API key is not valid (400)", "copy it again from Cloud Console → APIs & Services → Credentials.");
  } else fail(`Google responded ${res.status}: ${msg}`);
}

const folderArg = process.argv.indexOf("--folder");
if (folderArg > -1 && process.argv[folderArg + 1]) folder = process.argv[folderArg + 1];

await probe();

console.log("");
if (fails) console.log(`${c.r}${fails} problem${fails === 1 ? "" : "s"}${c.x}, ${warns} warning${warns === 1 ? "" : "s"}. Fix the ✗ items, then run again.`);
else console.log(`${c.g}All good${c.x} (${warns} warning${warns === 1 ? "" : "s"}). Start the app with: npm run dev`);
process.exit(fails ? 1 : 0);
