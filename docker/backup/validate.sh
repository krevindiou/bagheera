#!/usr/bin/env bash
# Checks the backup configuration: prints one `ERROR: <msg>` line per violated
# rule (and `WARN: <msg>` per warning) and exits 1 when there is any error.
# Runs as x-pre_deploy and at container start, so a bad config fails the
# deploy with a readable message instead of failing at 3 a.m.
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh

errors=0

error() {
  printf 'ERROR: %s\n' "$*" >&2
  errors=$((errors + 1))
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
}

positive_integer() {
  local name=$1 value
  value=$(cfg "$name" "$2")
  [[ $value =~ ^[1-9][0-9]*$ ]] || error "$name must be a positive integer (got '$value')"
}

if backup_disabled; then
  exit 0
fi

if ! restic_enabled && ! email_enabled; then
  error "no backup destination configured: set RESTIC_REPOSITORY and/or BACKUP_EMAIL_TO, or BACKUP_DISABLED=true"
fi

if restic_enabled && [ -z "${RESTIC_PASSWORD:-}" ]; then
  error "RESTIC_PASSWORD is required when RESTIC_REPOSITORY is set"
fi

if [ -n "${BACKUP_SFTP_PRIVATE_KEY:-}" ] && [ -z "${BACKUP_SFTP_KNOWN_HOSTS:-}" ]; then
  error "BACKUP_SFTP_KNOWN_HOSTS is required when BACKUP_SFTP_PRIVATE_KEY is set"
fi

if email_enabled; then
  recipient=${BACKUP_EMAIL_AGE_RECIPIENT:-}
  if [ -z "$recipient" ]; then
    error "BACKUP_EMAIL_AGE_RECIPIENT is required when BACKUP_EMAIL_TO is set"
  elif ! printf '' | age -r "$recipient" >/dev/null 2>&1; then
    error "BACKUP_EMAIL_AGE_RECIPIENT is not a valid age recipient"
  fi
fi

positive_integer BACKUP_KEEP_DAILY 7
positive_integer BACKUP_KEEP_WEEKLY 4
positive_integer BACKUP_KEEP_MONTHLY 6
positive_integer BACKUP_EMAIL_MAX_MB 10

schedule=$(cfg BACKUP_SCHEDULE '0 3 * * *')
crontab_file=$(mktemp)
trap 'rm -f "$crontab_file"' EXIT
printf '%s true\n' "$schedule" >"$crontab_file"
if ! supercronic -test "$crontab_file" >/dev/null 2>&1; then
  error "BACKUP_SCHEDULE is not a valid cron expression (got '$schedule')"
fi

report=$(cfg BACKUP_REPORT failure)
case $report in
  failure | always) ;;
  *) error "BACKUP_REPORT must be failure or always (got '$report')" ;;
esac

if ! alert_enabled; then
  warn "BACKUP_ALERT_EMAIL is not set: failures will only show in the container logs"
fi

[ "$errors" -eq 0 ]
