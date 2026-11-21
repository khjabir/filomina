# Filomina · AI photo finder for a shared Google Drive

A mobile-first Next.js web app that lets people **find themselves (or someone else) in the photos of a shared Google Drive folder**, including nested sub-folders. Face detection and recognition run **on the server** with ONNX Runtime and InsightFace models (SCRFD + ArcFace); photos are indexed once in the background, so searching thousands of photos takes seconds.

- **Public folders** (shared as *Anyone with the link*) open without sign-in, using a Google API key.
- **Private folders** trigger the Google OAuth flow (`drive.readonly`) and use the signed-in user's access.
- **Browse** folders and photos like in Drive, with breadcrumbs, lazy thumbnails and a lightbox.
- **Find me / Find someone**: take a selfie or upload one or more photos (different angles help), pick the face, and watch the assistant collect and scan every photo in the tree. Matches appear live with confidence scores; strictness can be adjusted afterwards. Mirrored selfies are handled by averaging the embedding of the face and its mirror image.
- **Background index**: the first time a folder is connected the server walks the tree and indexes every face (SQLite, `data/index/faces.sqlite`). Later searches only analyse new or changed photos, so a 2,000-photo drive answers in seconds.
- **Admin area** at a secret path (`ADMIN_PATH`): events, indexing, audit log. Direct `/admin` requests answer 404.
- **Audit log**: every search stores the query photo plus searcher details (time, Google account if signed in, IP, device, folder, result counts). Visitors are told about this in the cookie banner and the privacy policy, and must accept before searching. Admins can review the log at `/audit`.
- **Face templates** are 512-d ArcFace embeddings stored per photo; no image data leaves the server and no third-party AI service is involved.
- **Events**: in `/admin` an organiser attaches a Drive folder to a named event, indexes it once, and shares `/e/<code>`. Guests open the link, take a selfie and get their photos instantly, without any setup or sign-in. The general flow on the landing page keeps working alongside.
- **Runs anywhere**: a Dockerfile and a Compose file with automatic HTTPS are included (best: a free Oracle Cloud ARM VM); Google Cloud Run and Vercel are supported with Turso as the database. Storage is libSQL (a local SQLite file, or Turso in the cloud) and indexing is done in time-boxed rounds that fit serverless limits.

## Quick start

```bash
npm install
npm run fetch-models         # downloads the face models once (~280 MB, or --pack sc for 16 MB)
cp .env.example .env.local   # then edit – see SETUP.md for a step-by-step guide
npm run check-env            # validates your settings, models and tests the API key
npm run dev
```

Requires Node.js 20.19 or newer. See SETUP.md for Google Cloud, events and hosting options, and DEPLOY-ORACLE.md for the free Oracle Cloud VM walkthrough.

Open http://localhost:3000. [SETUP.md](SETUP.md) walks through the Google Cloud console screen by screen.

### Minimal configuration

| Goal | What to set |
| --- | --- |
| Public shared folder, no sign-in | `GOOGLE_API_KEY` (+ optionally `DRIVE_ROOT_FOLDER_ID`) |
| Private folder with Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `SESSION_SECRET` |
| Audit viewer at `/audit` | `AUDIT_ADMIN_KEY` |
| Try it with photos on this machine | `DRIVE_LOCAL_DIR=/path/to/photos` (no Google needed) |

If `DRIVE_ROOT_FOLDER_ID` is empty, the app asks the visitor to paste a Drive folder link. Visitors can also switch folders from the menu at any time.

### Google Cloud setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **Google Drive API**.
2. **API key** (public folders): *APIs & Services → Credentials → Create credentials → API key*. Restrict it to the Drive API. Put it in `GOOGLE_API_KEY`.
3. **OAuth client** (private folders): *Create credentials → OAuth client ID → Web application*. Add `http://localhost:3000/api/auth/google/callback` (and your production URL) as an authorised redirect URI. Put the client ID/secret in `.env.local`. While the OAuth consent screen is in *Testing*, add the Google accounts that may sign in as test users. The `drive.readonly` scope is a restricted scope and needs verification before public release.
4. Folder ID: the last part of `https://drive.google.com/drive/folders/<ID>`.

The camera needs a secure context: `localhost` works, on a phone use HTTPS (e.g. a tunnel or your deployment).

## How the face search works

1. **Capture** – selfie (front camera) or upload; the photo is downscaled to 1280 px and sent to `/api/face/analyze`.
2. **Detect & embed** – SCRFD finds faces with 5 landmarks; each face is aligned to the ArcFace template and embedded (512-d). The query face is embedded twice, normal and mirrored, and the two vectors are averaged so mirrored selfies match. If several faces are found the user picks one. Up to five reference photos can be combined; a photo matches if any reference matches.
3. **Audit** – the reference photos and search metadata are posted to `/api/audit` (requires the consent cookie).
4. **Index** – `/api/face/search` streams server-sent events. The server walks the folder tree, scores every photo already in the index instantly, and analyses the remaining photos (1024 px thumbnails) on the fly, storing their templates for next time. Connecting a folder also kicks off indexing in the background (`/api/index/start`), so by the time someone searches most of the work is done.
5. **Results** – cosine similarity between the query and every stored face; sorted by similarity with a strictness slider (thresholds per model), folder filters, a lightbox with the matched face highlighted, and *Open in Drive* / *Download* links.

### Models

`npm run fetch-models` downloads the InsightFace **buffalo_l** pack (SCRFD-10GF detector, ArcFace ResNet-50) into `models/`. Use `--pack sc` for the 16 MB MobileFaceNet pack on small servers (lower accuracy). The InsightFace weights are published for non-commercial research use; review their licence before commercial deployment, or drop in other ONNX models with the same input/output layout.

Tuning (env): `FACE_INDEX_CONCURRENCY` (photos analysed in parallel), `FACE_THREADS` (CPU threads per inference), `FACE_MIN_FACE_PX` (ignore faces smaller than this in 1024 px thumbnails).

## Project layout

```
app/
  page.tsx                 home: assistant, Find me / Find someone, folder preview, index status
  browse/[folderId]/       folder browser
  search/                  capture → face picker → scan → results
  privacy/                 privacy policy & cookie table (reads env for retention/contact)
  audit/                   admin audit viewer
  api/drive/*              status · list · path · thumb · media (Google Drive proxy)
  api/auth/*               Google OAuth start/callback/logout/me
  api/face/analyze         faces + embeddings of an uploaded photo
  api/face/search          streaming search (SSE), resumable in rounds
  api/index/*              indexing rounds: run · status · stats
  api/events/[slug]        public event info
  api/admin/*              admin: events CRUD, event indexing, session
Dockerfile, deploy/        container image and Compose stack with Caddy (HTTPS)
  e/[slug]/                public event pages (landing, search, browse)
  admin/                   admin dashboard, new event, event detail
  api/audit, api/consent   audit log and consent recording
components/                UI (brand mark, scan stage, results, consent banner, …)
lib/
  drive.ts                 Drive v3 REST client (API key or OAuth token)
  drive-images.ts          thumbnail/media bytes for Drive or the local folder
  local-drive.ts           optional local-folder backend
  google-oauth.ts          OAuth URLs, token exchange/refresh, session validation
  session.ts               encrypted session cookie (jose, A256GCM)
  face/engine.ts           ONNX Runtime: SCRFD detection, ArcFace alignment + embedding
  db.ts                    libSQL client (local file or Turso) + schema
  audit-db.ts              audit log and reference photos (database)
  events.ts                events, encrypted Drive access for private folders
  face/index-db.ts         face index tables
  face/indexer.ts          collect tree, find pending, analyse within a time budget
  index-run.ts             one indexing round (used by search, index runs, admin)
scripts/                   fetch-models · check-env · make-icons
models/                    ONNX models (git-ignored)
data/                      runtime data (git-ignored): audit/, uploads/, index/
```

## Data, privacy and retention

- Audit records and the reference photos (≤1024 px JPEG) live in the database; entries older than `AUDIT_RETENTION_DAYS` (default 90) are pruned automatically when new searches are logged.
- Face index, events and audit share one database: `data/index/faces.sqlite` locally, or Turso when `TURSO_DATABASE_URL` is set.
- Cookies: `filomina_consent`, `filomina_session` (encrypted, HTTP-only), `filomina_oauth`, `filomina_admin`. Local storage: connected folder.
- Edit the policy text in `app/privacy/page.tsx` and set `APP_OPERATOR_NAME` / `PRIVACY_CONTACT_EMAIL` before going live.

The storage layer is a single module (`lib/storage.ts`) so it can be swapped for a database when needed.

## Scripts

- `npm run dev` – development server (Turbopack)
- `npm run build` / `npm start` – production build and server (Node.js; the file store needs a writable `DATA_DIR`)
- `npm run lint` – ESLint
- `npm run check-env` – validates `.env.local`, checks the models and probes Google Drive with your API key
- `npm run fetch-models` – downloads the face models (`--pack sc` for the light pack)
- `npm run make-icons` – regenerates PNG icons from `public/icon.svg`
- `npm run upload-models` – uploads the models to Vercel Blob and prints `FACE_MODELS_URL`
