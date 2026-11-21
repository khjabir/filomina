# Filomina · setup guide

This walks you through every setting in `.env.local`. Run `npm run check-env` at any point: it validates what you have entered, prints the exact redirect URI to register, and tests your API key against your folder.

## 0. Decide which access mode you need

| Your drive folder is… | What you need | Visitors |
| --- | --- | --- |
| Shared as **Anyone with the link** | an **API key** (step 2) | open the app, no sign-in |
| Private / shared with specific people | an **OAuth client** (step 3) | sign in with Google; the app reads the folder with *their* access |
| Both kinds, or not sure yet | both | public folders open instantly, private ones ask for sign-in |

Everything in Google Cloud below is free. The Drive API is rate-limited, not billed, and no billing account is required.

## 1. Create a Google Cloud project and enable the Drive API

1. Open <https://console.cloud.google.com/> and sign in.
2. Top bar → project selector → **New project** → name it `Filomina` → **Create** → switch to it.
3. Left menu → **APIs & Services → Library** → search **Google Drive API** → **Enable**.

## 2. API key (public folders, no sign-in)

1. **APIs & Services → Credentials → + Create credentials → API key**. Copy the key (starts with `AIza`).
2. Click the key to edit it:
   - *API restrictions* → **Restrict key** → tick **Google Drive API** → Save.
   - *Application restrictions*: leave **None** for now. The key is only used server-side, never in the browser. On a production server with a fixed IP you can choose **IP addresses** and add it.
3. In `.env.local`: `GOOGLE_API_KEY=AIza…`

Share the folder so the key can read it: in Google Drive, right-click the folder → **Share → General access → Anyone with the link → Viewer**. Sub-folders inherit this. Files synced from other people may need the same.

## 3. OAuth client (private folders, Google sign-in)

### 3a. Consent screen (once per project)

1. **APIs & Services → OAuth consent screen** (Google now calls this **Google Auth Platform → Branding**).
2. Audience **External**, app name **Filomina**, your support e-mail, developer contact e-mail → Save.
3. **Data access / Scopes → Add or remove scopes** → tick `.../auth/drive.readonly`, plus `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → Update → Save.
4. **Audience / Test users → Add users** → add every Google account that should be able to sign in while the app is in *Testing* (up to 100). Anyone else sees "Access blocked: app has not completed Google's verification".
5. For a public launch you must later **Publish** the app and go through verification, because `drive.readonly` is a restricted scope. Testing mode is enough for a team or family.

### 3b. The client

1. **Credentials → + Create credentials → OAuth client ID → Web application**, name `Filomina web`.
2. **Authorised JavaScript origins**: `http://localhost:3000` (add your real domain later, e.g. `https://photos.example.com`).
3. **Authorised redirect URIs**: `http://localhost:3000/api/auth/google/callback` (and later `https://photos.example.com/api/auth/google/callback`). It must match `APP_URL` exactly, including the port. `npm run check-env` prints the URI to use.
4. **Create** → copy the **Client ID** (ends in `.apps.googleusercontent.com`) and **Client secret** into `.env.local`.

## 4. Which folder

Open the folder in Google Drive. The URL looks like `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`; the part after `/folders/` is the ID.

- `DRIVE_ROOT_FOLDER_ID=1AbC…` opens that folder by default.
- Leave it empty and the app asks each visitor to paste a folder link. Visitors can always switch folders from the menu.

## 5. App settings

| Variable | What to put | Notes |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` locally, `https://your-domain` in production | Origin only, no trailing slash. If the dev server starts on 3001 because 3000 is busy, either free port 3000 or set `APP_URL=http://localhost:3001` **and** register that redirect URI too. |
| `SESSION_SECRET` | any 32+ random characters | Already generated in your `.env.local`. New value: `openssl rand -base64 32`. Changing it signs everyone out. |
| `NEXT_PUBLIC_APP_NAME` | `Filomina` | Shown in the UI and the privacy policy. |
| `AUDIT_ADMIN_KEY` | a long random string | Already generated. Unlocks the admin area. Empty = admin disabled. |
| `ADMIN_PATH` | a random path segment, e.g. `manage-3f9a…` | The admin area is served at `/<ADMIN_PATH>` only; `/admin` and `/audit` answer 404. Keep it secret like a password. |
| `AUDIT_RETENTION_DAYS` | `90` | Uploaded search photos and audit entries older than this are deleted automatically. |
| `DATA_DIR` | `./data` | Must be writable and persistent (a volume, not a temp dir, in production). |
| `APP_OPERATOR_NAME` | your name / organisation | Appears in the privacy policy as the party responsible. |
| `PRIVACY_CONTACT_EMAIL` | an e-mail you monitor | Appears in the privacy policy for data requests. |
| `DRIVE_LOCAL_DIR` | a folder of photos on this machine | Testing only. While set, Google is bypassed entirely. |
| `FACE_MODELS_DIR` | `./models` | Where `npm run fetch-models` puts the ONNX files. |
| `FACE_INDEX_CONCURRENCY` | `2` | Photos analysed in parallel while indexing. |
| `FACE_REQUEST_BUDGET_MS` | `240000` | Max time one request spends analysing photos; the clients loop until done. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | hosted libSQL database | Required on Vercel; empty = local SQLite file. |
| `FACE_MODELS_URL` / `FACE_MODEL_PACK` | base URL of the two model files | Required on Vercel; see `npm run upload-models`. |

## 6. Face models

The face engine runs on the server and needs two ONNX model files. Download them once:

```bash
npm run fetch-models
```

This fetches the InsightFace *buffalo_l* pack from GitHub (about 280 MB) and extracts `det_10g.onnx` and `w600k_r50.onnx` into `models/`. On a small server use `npm run fetch-models -- --pack sc` (16 MB, lower accuracy). The weights are published for non-commercial research use; check the InsightFace licence before commercial deployment.

Node.js 22.13 or newer is required (the index uses the built-in SQLite module).

## 7. Verify

```bash
npm run check-env
```

Then start the app:

```bash
npm run dev
```

- With an API key and a public folder you should land on the home page with the folder name in the header.
- With OAuth only, you get the "Sign in with Google" screen; sign in with one of the test users.
- Camera capture needs `localhost` or HTTPS. On a phone, use an HTTPS tunnel (for example `ngrok http 3000`) and set `APP_URL` plus a matching redirect URI to the tunnel address.

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "This folder is not public. Sign in with Google" although you shared it | Sharing is not *Anyone with the link*, or the ID is wrong. `npm run check-env` tells you which. |
| `API key not valid` | Copy the key again; make sure there is no whitespace. |
| 403 `Google Drive API has not been used in project…` | Step 1.3 was skipped. Enable the API and wait a minute. |
| `redirect_uri_mismatch` on sign-in | The redirect URI in the OAuth client does not match `APP_URL` + `/api/auth/google/callback` exactly (scheme, host, port). |
| "Access blocked: Filomina has not completed the Google verification process" | Add the account under *Test users*, or publish and verify the app. |
| Signed in, but "does not have access to this folder" | The Google account used to sign in cannot see that folder in Drive. |
| Camera does not start | Not a secure context (plain http on a non-localhost host), or permission denied. Upload works regardless. |
| Audit viewer says "disabled" | `AUDIT_ADMIN_KEY` is empty. |
| "Face models are not installed on this server" | Run `npm run fetch-models`, then restart the app. |
| Indexing is slow | Raise `FACE_INDEX_CONCURRENCY` on multi-core servers, or use the light model pack. The first run indexes everything; later searches only touch new photos. |

## 9. Events (shareable links)

Open `/admin` (unlock with `AUDIT_ADMIN_KEY`) → **New event**. Give it a name and paste the Drive folder link. For a private folder, sign in with Google first (top right of the admin area) with an account that can see the folder; its access is stored encrypted with the event so guests never sign in. Then press **Start indexing** and keep the page open until it reaches 100 %. Share the link `/e/<code>`: guests can browse, take a selfie and find themselves instantly, and the first page remains the general-purpose flow.

Note: while the Google OAuth consent screen is in *Testing*, Google expires refresh tokens after 7 days, so private-folder events need re-linking weekly. Publish the OAuth app to avoid this.

## 10. Where to host it (and what it costs)

The face engine needs CPU time and a place to keep ~200 MB of models plus the index. That rules most "free serverless" tiers out, and makes a small always-on machine the best fit.

| Option | Cost | Speed | Notes |
| --- | --- | --- | --- |
| **Oracle Cloud "Always Free" VM** (Ampere A1, up to 4 cores / 24 GB) | free, card required, no expiry | fastest: ~2–4 photos/s indexing, searches well under a second | Everything on local disk (models, SQLite, audit). Run with Docker Compose below. Recommended. |
| **Google Cloud Run** (always-free tier) + **Turso** (free) | free within limits, card required | fast when warm; 3–8 s cold start after idle | Models baked into the image, database in Turso. Scales to zero. |
| **Your own Mac/PC** + **Cloudflare Tunnel** (free) | free | fastest | Only online while the machine is on. Good for events you run yourself. |
| **Vercel Hobby** | free, non-commercial only | slow first requests (model download), 4 CPU-hours/month | Fine for a demo, not for several events. |
| Render / Railway / Fly free tiers | free or trial | too little CPU/RAM for the full model, disks are ephemeral | Not recommended. |

The models never need Google Drive or any file storage service: on a VM they sit on disk after `npm run fetch-models` (or inside the Docker image); only serverless platforms need `FACE_MODELS_URL`.

### Docker (VM, Cloud Run, anything)

```bash
docker build -t filomina .                # uses ./models if present, else downloads them
docker run -d -p 3000:3000 --env-file .env.local -v filomina-data:/data filomina
```

`deploy/docker-compose.yml` adds Caddy for automatic HTTPS (needed for the camera): point a DNS name at the server, set `APP_URL=https://<domain>` in `.env.local`, then

```bash
DOMAIN=photos.example.com docker compose -f deploy/docker-compose.yml up -d --build
```

### Oracle Cloud Always Free

The complete walkthrough, from creating the account to the first event, is in [DEPLOY-ORACLE.md](DEPLOY-ORACLE.md). Summary:

1. Create an account at <https://cloud.oracle.com> (a card is required for identity; the Always Free tier never charges).
2. Compute → Instances → **Create instance**: image *Ubuntu 22.04 (aarch64)*, shape *VM.Standard.A1.Flex* with 2–4 OCPUs and 12–24 GB (all within Always Free). If the region is "out of capacity", retry later or pick another availability domain.
3. Networking: in the VCN's security list, allow ingress TCP 80 and 443. On the VM: `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and the same for 443 (Oracle images ship with a restrictive iptables rule set).
4. Install Docker (`curl -fsSL https://get.docker.com | sh`), `git clone` your repository, copy your `.env.local`, and run the compose command above. Build takes a few minutes the first time.
5. Set `FACE_INDEX_CONCURRENCY` to the number of cores and `FACE_REQUEST_BUDGET_MS=3600000` so indexing runs in long rounds.

### Google Cloud Run

```bash
gcloud run deploy filomina --source . --region europe-west1 --memory 2Gi --cpu 2 --timeout 900 \
  --set-env-vars TURSO_DATABASE_URL=...,TURSO_AUTH_TOKEN=...,SESSION_SECRET=...,APP_URL=https://...
```

Use `TURSO_DATABASE_URL` (the container's disk is ephemeral), keep `FACE_REQUEST_BUDGET_MS` under the timeout, and set the other variables from section 5. The always-free tier covers 180,000 vCPU-seconds a month, roughly 25 events of 2,000 photos.

## 11. Deploying to Vercel

The app runs on Vercel with two external pieces, because serverless functions have no persistent disk and a 250 MB bundle limit:

1. **Database** – create a free [Turso](https://turso.tech) database (also available from the Vercel Marketplace). Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The schema is created automatically on first use.
2. **Models** – the face models (180 MB) are downloaded by the function at cold start and cached. Upload them once to Vercel Blob (Storage → Create → Blob, copy the token), then locally:

   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_… npm run upload-models
   ```

   and set the printed `FACE_MODELS_URL` (and `FACE_MODEL_PACK`) in Vercel. Any other public HTTPS location with the two `.onnx` files works too.
3. **Environment variables** in Vercel → Settings → Environment Variables: `APP_URL` (your production URL), `SESSION_SECRET`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUDIT_ADMIN_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `FACE_MODELS_URL`, `FACE_MODEL_PACK`, `FACE_REQUEST_BUDGET_MS=240000`, `APP_OPERATOR_NAME`, `PRIVACY_CONTACT_EMAIL`, optionally `FACE_INDEX_CONCURRENCY=2`.
4. In Google Cloud, add the production origin and `https://<your-domain>/api/auth/google/callback` to the OAuth client.
5. Import the GitHub repository in Vercel (framework preset: Next.js, Node.js 22). Fluid Compute should be enabled (it is by default) so functions may run up to 300 s on Hobby / 800 s on Pro; the heavy routes declare `maxDuration = 300`.

Indexing on Vercel runs in rounds of `FACE_REQUEST_BUDGET_MS`; the admin page and the search page keep calling until everything is covered. The first run over a large folder takes a while on serverless CPUs (roughly 1–2 photos per second with the full model), so index events ahead of time. Use `FACE_MODEL_PACK=sc` (and upload that pack) if speed matters more than accuracy.

## 12. Going to production (self-hosted)

- Serve over HTTPS; set `APP_URL` to the public origin and add it to the OAuth client (origin + redirect URI).
- Keep `.env.local` out of version control (it already is) and set the same variables on the server.
- Give `DATA_DIR` persistent storage, and back it up if the audit log matters to you.
- Review `app/privacy/page.tsx` so the wording matches how you actually run the service, and fill `APP_OPERATOR_NAME` / `PRIVACY_CONTACT_EMAIL`.
- Publish the OAuth consent screen and request verification for `drive.readonly` if people outside your test-user list need to sign in.
