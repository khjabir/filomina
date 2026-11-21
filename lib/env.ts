/** Server-side environment access with sane defaults. */

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Filomina",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  googleApiKey: process.env.GOOGLE_API_KEY || "",
  rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  auditAdminKey: process.env.AUDIT_ADMIN_KEY || "",
  auditRetentionDays: num(process.env.AUDIT_RETENTION_DAYS, 90),
  dataDir: process.env.DATA_DIR || "./data",
  /** Optional: serve a local folder of photos instead of Google Drive (testing). */
  localDir: process.env.DRIVE_LOCAL_DIR || "",
  /** Folder holding the ONNX face models (see scripts/fetch-models.mjs). */
  faceModelsDir: process.env.FACE_MODELS_DIR || "./models",
  /** Base URL to download the models from on serverless hosts (files cached in the OS temp dir). */
  faceModelsUrl: (process.env.FACE_MODELS_URL || "").replace(/\/$/, ""),
  /** Which pack the URL hosts: "l" (det_10g + w600k_r50) or "sc" (det_500m + w600k_mbf). */
  faceModelPack: (process.env.FACE_MODEL_PACK === "sc" ? "sc" : "l") as "sc" | "l",
  /** How long one request may spend analysing photos before handing back (serverless limits). */
  requestBudgetMs: num(process.env.FACE_REQUEST_BUDGET_MS, 240_000),
  /** Hosted database (Turso/libSQL). Empty = local SQLite file under DATA_DIR. */
  databaseUrl: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "",
  databaseAuthToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || "",
  isVercel: Boolean(process.env.VERCEL),
  /** Secret URL prefix for the admin area (empty = /admin, for development). */
  adminPath: (process.env.ADMIN_PATH || "").replace(/^\/+|\/+$/g, ""),
  /** Photos processed in parallel while indexing. */
  faceConcurrency: num(process.env.FACE_INDEX_CONCURRENCY, 2),
  /** CPU threads per inference (0 = let ONNX Runtime decide). */
  faceThreads: Number(process.env.FACE_THREADS) || 0,
  /** Faces smaller than this (pixels, in the 1024 px thumbnail) are too small to recognise. */
  faceMinPx: num(process.env.FACE_MIN_FACE_PX, 20),
  operatorName: process.env.APP_OPERATOR_NAME || "",
  privacyEmail: process.env.PRIVACY_CONTACT_EMAIL || "",
  isProd: process.env.NODE_ENV === "production",
  get oauthConfigured() {
    return Boolean(this.googleClientId && this.googleClientSecret);
  },
  get publicConfigured() {
    return Boolean(this.googleApiKey);
  },
};
