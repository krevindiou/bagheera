#!/usr/bin/env bash
# Nightly backup: pg_dump of the running postgres container, pushed to a
# restic repository. Run on the deploy host itself, as the dedicated
# `backup` user (a member of the `docker` group — enough for `docker exec`
# against the postgres container, without needing root).
#
# In production: root-owned at /usr/local/bin/backup.sh, the forced command
# of the backup user's CI key, configured from /etc/bagheera-backup.env. The
# caller sends nothing, so a leaked key can start a backup but not redirect
# it. See docs/backup-restore.md's "Deploy host SSH setup".
#
# Required env (from the environment, or from the env file below):
#   RESTIC_REPOSITORY, RESTIC_PASSWORD (or RESTIC_PASSWORD_FILE) — restic
#     target; any restic-supported backend works (S3-compatible via
#     AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, etc — see restic's own docs).
#   POSTGRES_PASSWORD — password for POSTGRES_USER inside the container.
# Optional env:
#   POSTGRES_CONTAINER (default: postgres) — under Kamal this is
#     "bagheera-web-postgres" (see config/deploy.yml), not the default.
#   POSTGRES_USER (default: bagheera)
#   POSTGRES_DB (default: bagheera)
#   BACKUP_KEEP_DAILY / BACKUP_KEEP_WEEKLY / BACKUP_KEEP_MONTHLY
#     (defaults: 7 / 4 / 6) — retention passed to `restic forget --prune`.
set -euo pipefail

# Host-held configuration; see the header. Skipped when absent (e.g. a
# manual run with the variables already exported).
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/bagheera-backup.env}"
if [[ -r "$BACKUP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$BACKUP_ENV_FILE"
  set +a
fi

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-bagheera}"
POSTGRES_DB="${POSTGRES_DB:-bagheera}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
BACKUP_KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"

dump_file="$(mktemp -t bagheera-backup-XXXXXX.pgdump)"
# --env-file, not `-e PGPASSWORD=...`, which would show the password in
# `ps`. The file is mode 600 and deleted on exit.
pgpass_env_file="$(mktemp -t bagheera-backup-env-XXXXXX)"
chmod 600 "$pgpass_env_file"
trap 'rm -f "$dump_file" "$pgpass_env_file"' EXIT
printf 'PGPASSWORD=%s\n' "$POSTGRES_PASSWORD" > "$pgpass_env_file"

echo "==> Dumping $POSTGRES_DB from container $POSTGRES_CONTAINER"
docker exec --env-file "$pgpass_env_file" "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$dump_file"

restic snapshots >/dev/null 2>&1 || restic init

echo "==> Pushing snapshot to $RESTIC_REPOSITORY"
restic backup --tag postgres --tag "bagheera-$(date -u +%Y-%m-%d)" "$dump_file"

echo "==> Pruning old snapshots (keep daily=$BACKUP_KEEP_DAILY weekly=$BACKUP_KEEP_WEEKLY monthly=$BACKUP_KEEP_MONTHLY)"
restic forget --prune \
  --keep-daily "$BACKUP_KEEP_DAILY" \
  --keep-weekly "$BACKUP_KEEP_WEEKLY" \
  --keep-monthly "$BACKUP_KEEP_MONTHLY" \
  --tag postgres

echo "==> Done"
