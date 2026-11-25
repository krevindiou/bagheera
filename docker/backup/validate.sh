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

# A local repository anywhere but the backup_data volume would live in the
# container, and be lost at the next deploy.
if restic_enabled && [[ $RESTIC_REPOSITORY == /* ]]; then
  if ! [[ $RESTIC_REPOSITORY =~ ^/backups(/|$) ]] || [[ $RESTIC_REPOSITORY =~ (^|/)\.\.(/|$) ]]; then
    error "RESTIC_REPOSITORY must be under /backups, the backup_data volume, when it is a local path (got '$RESTIC_REPOSITORY'): anywhere else it is lost at the next deploy"
  elif [ ! -w /backups ]; then
    error "/backups is not writable by the backup user (uid $(id -u)): the backup_data volume must be owned by uid $(id -u) (check its ownership on the host)"
  fi
fi

# Credentials a remote repository cannot work without: missing, they only fail
# at the first nightly run.
if restic_enabled; then
  case $RESTIC_REPOSITORY in
    sftp:*)
      if [ -z "${BACKUP_SFTP_PRIVATE_KEY:-}" ]; then
        error "BACKUP_SFTP_PRIVATE_KEY is required for an sftp: RESTIC_REPOSITORY"
      fi
      ;;
    s3:*)
      if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        error "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for an s3: RESTIC_REPOSITORY"
      fi
      ;;
    /* | *:*) ;;
    *)
      error "RESTIC_REPOSITORY must be an absolute path under /backups or a remote repository such as sftp: or s3: (got '$RESTIC_REPOSITORY'): a relative path is lost at the next deploy"
      ;;
  esac
fi

# curl takes one recipient per address: a display name or a list fails at send
# time (silently, for the alert address, whose failure has no one to alert).
single_address() {
  local name=$1 value=${!1:-} address='^[^[:space:]<>,;@"]+@[^[:space:]<>,;@"]+$'
  if [ -n "$value" ] && ! [[ $value =~ $address ]]; then
    error "$name must be one bare address such as ops@example.com, without a name or a list (got '$value')"
  fi
}
single_address BACKUP_EMAIL_TO
single_address BACKUP_ALERT_EMAIL

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
else
  # supercronic also takes 6 or 7 fields (seconds, years), which would shift
  # every field a 5-field expression means.
  read -r -d '' -a schedule_fields <<<"$schedule" || true
  if [ "${#schedule_fields[@]}" -ne 5 ]; then
    error "BACKUP_SCHEDULE must have exactly 5 fields: minute hour day month weekday (got '$schedule')"
  fi
fi

step_timeout=$(cfg BACKUP_STEP_TIMEOUT 2h)
if ! step_seconds=$(duration_seconds "$step_timeout") || [ "$step_seconds" -eq 0 ]; then
  error "BACKUP_STEP_TIMEOUT must be a positive duration: a number, optionally followed by s, m, h or d, such as 90m or 2h (got '$step_timeout')"
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
