#!/usr/bin/env bash
# Pull the latest code and rebuild/restart the stack without downtime for Caddy.
#   ./deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
DOMAIN="${DOMAIN:-$(grep -E '^APP_URL=' .env.local | sed -E 's#APP_URL=https?://##')}" docker compose -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null
docker compose -f deploy/docker-compose.yml ps
