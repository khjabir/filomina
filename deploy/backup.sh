#!/usr/bin/env bash
# Nightly backup of the database (face index, events, audit log) to ~/filomina-backups.
# Install:  crontab -e  →  15 3 * * * /home/ubuntu/filomina/deploy/backup.sh >> /home/ubuntu/filomina-backups/backup.log 2>&1
set -euo pipefail
DEST="${BACKUP_DIR:-$HOME/filomina-backups}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
docker run --rm -v filomina-data:/data:ro -v "$DEST":/backup alpine sh -c "cd /data && tar czf /backup/filomina-$STAMP.tgz ."
ls -1t "$DEST"/filomina-*.tgz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -Is) backup written: $DEST/filomina-$STAMP.tgz"
