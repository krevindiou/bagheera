#!/usr/bin/env bash
# Nightly backup: pg_dump of the running postgres container plus whatever
# WAL segments have accumulated since the last run, both pushed to a restic
# repository. Run on the deploy host itself, as root (it needs docker
# access to the postgres container, and the WAL segments on disk are owned
# by the container's postgres uid, unreadable by an unprivileged host user).
#
# Required env:
#   RESTIC_REPOSITORY, RESTIC_PASSWORD (or RESTIC_PASSWORD_FILE) — restic
#     target; any restic-supported backend works (S3-compatible via
#     AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, etc — see restic's own docs).
#   POSTGRES_PASSWORD — password for POSTGRES_USER inside the container.
# Optional env (defaults match docker/compose.prod.yml):
#   POSTGRES_CONTAINER (default: postgres)
#   POSTGRES_USER (default: bagheera)
#   POSTGRES_DB (default: bagheera)
#   WAL_ARCHIVE_DIR (default: /var/lib/bagheera/wal-archive) — host
#     directory postgres's archive_command copies WAL segments into.
#   BACKUP_KEEP_DAILY / BACKUP_KEEP_WEEKLY / BACKUP_KEEP_MONTHLY
#     (defaults: 7 / 4 / 6) — retention passed to `restic forget --prune`.
set -euo pipefail

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-bagheera}"
POSTGRES_DB="${POSTGRES_DB:-bagheera}"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/bagheera/wal-archive}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
BACKUP_KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"

dump_file="$(mktemp -t bagheera-backup-XXXXXX.pgdump)"
trap 'rm -f "$dump_file"' EXIT

echo "==> Dumping $POSTGRES_DB from container $POSTGRES_CONTAINER"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$dump_file"

restic snapshots >/dev/null 2>&1 || restic init

backup_paths=("$dump_file")
if [ -d "$WAL_ARCHIVE_DIR" ]; then
  backup_paths+=("$WAL_ARCHIVE_DIR")
else
  echo "==> WAL_ARCHIVE_DIR ($WAL_ARCHIVE_DIR) not found, skipping WAL segments"
fi

echo "==> Pushing snapshot to $RESTIC_REPOSITORY"
restic backup --tag postgres --tag "bagheera-$(date -u +%Y-%m-%d)" "${backup_paths[@]}"

echo "==> Pruning old snapshots (keep daily=$BACKUP_KEEP_DAILY weekly=$BACKUP_KEEP_WEEKLY monthly=$BACKUP_KEEP_MONTHLY)"
restic forget --prune \
  --keep-daily "$BACKUP_KEEP_DAILY" \
  --keep-weekly "$BACKUP_KEEP_WEEKLY" \
  --keep-monthly "$BACKUP_KEEP_MONTHLY" \
  --tag postgres

echo "==> Done"
