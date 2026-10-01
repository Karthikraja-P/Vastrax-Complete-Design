#!/usr/bin/env bash
# Nightly backup: consistent SQLite snapshot + uploads/3D models, keeps the last 14 days. Run from WSL.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${BACKUP_DIR:-$HOME/vastrax-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

python3 - "$DIR/backend/vastrax.db" "$DEST/vastrax-$STAMP.db" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
src.backup(dst)  # online, consistent even while the app is writing
dst.close(); src.close()
chk = sqlite3.connect(sys.argv[2]).execute("pragma integrity_check").fetchone()[0]
assert chk == "ok", f"backup failed integrity check: {chk}"
PY

tar -czf "$DEST/files-$STAMP.tar.gz" -C "$DIR" backend/user_uploads public/models/3d
find "$DEST" -type f \( -name 'vastrax-*.db' -o -name 'files-*.tar.gz' \) -mtime +14 -delete
[ -n "${BACKUP_SYNC_CMD:-}" ] && eval "$BACKUP_SYNC_CMD"  # optional off-machine copy, e.g. rclone copy "$DEST" remote:vastrax
echo "backup written to $DEST ($STAMP)"
