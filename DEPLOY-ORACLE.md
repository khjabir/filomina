# Filomina on Oracle Cloud "Always Free" – step by step

This runs the whole app (face engine, index, events, audit log) on one free ARM virtual machine with automatic HTTPS. Nothing else is needed: no Vercel, no Turso, no file storage for the models.

## 0. Will it charge me?

- Oracle's **Free Tier** account has two parts: a 30-day trial with US$300 of credits, and **Always Free** resources that never expire. When the trial ends, the account stays in Free Tier mode: it **cannot create anything that costs money** and Oracle does not bill it. You are only ever charged if you explicitly click **Upgrade to Pay As You Go**. Do not do that, and keep the card on file only for identity verification.
- Everything in this guide is inside the Always Free limits: one Ampere A1 VM with up to **4 OCPUs and 24 GB RAM**, up to **200 GB** of block storage, 10 TB of outbound traffic per month, and a public IPv4 address.
- Two things to know:
  1. **Idle reclamation.** Oracle may stop an Always Free A1 instance that stays idle for 7 days (CPU, memory and network all under 20%). An event app that is used now and then can look idle. Step 10 installs a tiny scheduled job that prevents this, and step 9 backs up your data nightly so even a reclaimed VM costs you nothing but a redeploy.
  2. **Out of capacity.** Free A1 capacity is popular. If instance creation fails with "Out of host capacity", retry (see step 3).

Time needed: about 45 minutes, most of it waiting for the account and the first Docker build.

## 1. Create the account

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Fill in country, name, e-mail; verify the e-mail; set a password.
3. **Home region**: pick the region closest to your guests. It cannot be changed later, and Always Free A1 capacity varies by region. Avoid the most crowded ones if you can (for example choose a secondary region of your continent).
4. Enter your address and card. Oracle places a small temporary authorization (released automatically) to verify it. No charge.
5. Wait for the "Your account is ready" e-mail (minutes to a few hours), then sign in at <https://cloud.oracle.com>.

Do **not** click "Upgrade" anywhere. The banner about trial credits can be ignored.

## 2. Get a free domain name (needed for HTTPS and the camera)

Oracle gives the VM a public IP but no hostname. Browsers only allow the camera on HTTPS, and Google OAuth needs a stable redirect URL, so you need a name. The free equivalent of Vercel's `something.vercel.app` is a **DuckDNS** subdomain:

1. Open <https://www.duckdns.org> and sign in with Google or GitHub (no card, no cost).
2. Type a name in the "sub domain" box, e.g. `myphotos`, click **add domain**. You now own `myphotos.duckdns.org`.
3. After step 3 below, paste the VM's public IP into the **current ip** field of that row and click **update ip**. That is all: DNS is live within a minute.

Why DuckDNS rather than other free options: it is on the Public Suffix List, so Let's Encrypt treats `myphotos.duckdns.org` as its own site and the certificate is issued automatically by Caddy on the first visit. Shared "IP-in-the-name" services such as nip.io or sslip.io hit shared certificate rate limits, and free TLD registrars (.tk, .ml) are unreliable. Alternatives that also work: a subdomain from FreeDNS (<https://freedns.afraid.org>, many shared domains), or any domain you own with an **A record** pointing at the VM (about US$2–12 a year at Porkbun, Cloudflare or Namecheap if you want a nicer name later; just change `APP_URL`, `DOMAIN` and the Google OAuth URIs).

The VM's public IP stays the same for as long as the instance exists (stopping and starting keeps it). To make it survive even a rebuild, Oracle lets you convert it to a **reserved public IP** for free: instance → Attached VNICs → VNIC → IPv4 addresses → Edit → Reserved public IP.

In the rest of this guide `photos.example.com` stands for your name, for example `myphotos.duckdns.org`.

## 3. Create the VM

1. Console menu ☰ → **Compute → Instances → Create instance**.
2. Name: `filomina`. Compartment: leave the default (root).
3. **Image and shape → Edit**:
   - Image: **Canonical Ubuntu 24.04** (make sure the *aarch64* / ARM build is selected after choosing the shape).
   - Shape: **Ampere → VM.Standard.A1.Flex**, set **4 OCPUs** and **24 GB** memory. The shape shows "Always Free-eligible". (2 OCPUs / 12 GB also work; indexing is then about half as fast.)
4. **Networking**: "Create new virtual cloud network", "Create new public subnet", **Assign a public IPv4 address: yes**.
5. **Add SSH keys**: "Generate a key pair for me" → download both files and keep them (`ssh-key-….key`). Or paste your own public key.
6. **Boot volume**: tick "Specify a custom boot volume size" and enter **100 GB** (still free; the default 47 GB also works).
7. **Create**. The instance should be *Running* within a minute or two. Note the **Public IP address**.

If you get **"Out of host capacity"**: wait 15–60 minutes and try again, try another *availability domain* if your region has several (Hyderabad has one), try 2 OCPUs / 12 GB, or try early in the morning in the region's time zone. Capacity frees up regularly; most people succeed within a day.

### 3b. Let a script retry for you

`deploy/oracle-retry-launch.sh` retries every 5 minutes from Oracle's free **Cloud Shell** (terminal icon next to the region name). Fill in four values at the top of the script:

- **COMPARTMENT_OCID**: profile menu (top right) → *Tenancy: …* → copy the **OCID**.
- **SUBNET_OCID**: Networking → Virtual cloud networks → `filomina-vcn` → Subnets → *public subnet-filomina-vcn* → copy the **OCID**.
- **SSH_PUBLIC_KEY**: the content of the `.pub` file you saved (one line starting with `ssh-rsa`).
- **OCPUS / MEMORY_GB**: 4 / 24, or 2 / 12 if 4 never succeeds.

Then in Cloud Shell: paste the script into a file (`nano retry.sh`), save, and run `bash retry.sh`. Keep the browser tab open; Cloud Shell disconnects after a long time without interaction, so check on it every few hours. When it prints SUCCESS, continue with the public IP from the Instances page.

Now put the public IP into DuckDNS (or your DNS A record).

## 4. Open the firewall (two places)

Oracle has a cloud firewall *and* a firewall inside the Ubuntu image.

1. Cloud: Instance page → **Subnet** link → **Security Lists → Default Security List → Add Ingress Rules**. Add two rules with Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port **80**, and another with port **443**. Also add protocol **UDP** port **443** (HTTP/3, optional).
2. On the VM (after step 5's SSH login):

   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 5. Connect and install Docker

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>
```

On the VM:

```bash
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo apt-get -y install unattended-upgrades git
exit
```

Log in again (so the docker group applies) and check `docker ps` works without sudo.

## 6. Put the code on the VM

Either clone your GitHub repository:

```bash
git clone https://github.com/<you>/<repo>.git filomina
cd filomina
```

or copy the project folder from your computer (from your Mac, excluding node_modules):

```bash
rsync -av --exclude node_modules --exclude .next --exclude data --exclude models ./filomina/ ubuntu@<PUBLIC_IP>:~/filomina/ -e "ssh -i ~/Downloads/ssh-key-*.key"
```

`models/` is not needed on the VM: the Docker build downloads the models (about 280 MB) once. If you prefer, copy the `models` folder too and the build will reuse it.

## 7. Configure

```bash
cd ~/filomina
cp .env.example .env.local
nano .env.local
```

Fill in (the rest can stay as in the example):

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://photos.example.com` |
| `SESSION_SECRET` | output of `openssl rand -base64 32` |
| `AUDIT_ADMIN_KEY` | output of `openssl rand -hex 24` – this unlocks the admin area |
| `ADMIN_PATH` | `manage-` followed by the output of `openssl rand -hex 8` – your secret admin URL |
| `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from your Google Cloud project (SETUP.md sections 1–3) |
| `DRIVE_ROOT_FOLDER_ID` | optional default folder for the landing page |
| `APP_OPERATOR_NAME`, `PRIVACY_CONTACT_EMAIL` | shown in the privacy policy |
| `FACE_MODELS_DIR` | `./models` (leave) |

Then in Google Cloud → Credentials → your OAuth client, add `https://photos.example.com` to the authorised origins and `https://photos.example.com/api/auth/google/callback` to the redirect URIs.

Validate: `docker run --rm -v "$PWD":/app -w /app node:22-slim node scripts/check-env.mjs` (or run `npm run check-env` on your computer with the same values).

## 8. Start

```bash
DOMAIN=photos.example.com docker compose -f deploy/docker-compose.yml up -d --build
```

The first build takes 5–10 minutes (model download, dependencies, Next.js build). Watch it with `docker compose -f deploy/docker-compose.yml logs -f app`. When you see `Ready`, open `https://photos.example.com`: Caddy obtains the certificate automatically on the first request (give it a few seconds).

Admin area: `https://photos.example.com/<ADMIN_PATH>` → enter `AUDIT_ADMIN_KEY` → **New event**. For a private folder, click **Sign in with Google** in the admin bar first. Start indexing and keep the tab open until it reaches 100% (about 10–15 minutes for 2,000 photos on 4 cores). Share the event link.

## 9. Backups (nightly, free)

```bash
crontab -e
```

Add:

```
15 3 * * * /home/ubuntu/filomina/deploy/backup.sh >> /home/ubuntu/filomina-backups/backup.log 2>&1
```

Backups land in `~/filomina-backups` (14 kept). To copy them off the VM occasionally: `scp -i <key> ubuntu@<PUBLIC_IP>:~/filomina-backups/filomina-*.tgz .` Restoring: `docker run --rm -v filomina-data:/data -v ~/filomina-backups:/b alpine sh -c "cd /data && tar xzf /b/<file>.tgz"`.

## 10. Keep the free VM from being reclaimed

Oracle reclaims Always Free A1 instances that are idle for 7 days. A small periodic workload keeps it classified as active:

```bash
sudo apt-get -y install stress-ng
( crontab -l; echo "*/20 * * * * stress-ng --cpu 1 --timeout 60s >/dev/null 2>&1" ) | crontab -
```

This uses one core for one minute every 20 minutes, within what you are entitled to, and costs nothing.

## 11. Updating

```bash
cd ~/filomina && ./deploy/update.sh
```

## 12. Checks and troubleshooting

- `docker compose -f deploy/docker-compose.yml ps` – both containers should be *healthy*/*running*.
- `docker compose -f deploy/docker-compose.yml logs --tail=100 app` – app log (`[filomina] face engine ready` appears on the first search or index run).
- Certificate errors: DNS not pointing at the VM yet, or ports 80/443 blocked (step 4, both places).
- "Face models are not installed": the build could not download them; rerun the build with internet access or copy `models/` into the project folder.
- Camera not starting: the page must be `https://`.
- Google sign-in error `redirect_uri_mismatch`: fix the URIs in step 7.
- Billing worries: Console → **Billing & Cost Management → Cost analysis** always shows 0 for a Free Tier account; the account type is shown under **Account Management → Tenancy details** as "Free Tier".
