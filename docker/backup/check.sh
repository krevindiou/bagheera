#!/usr/bin/env bash
# Weekly integrity check of the restic repository: `restic check` verifies the
# repository structure and that every pack the index lists still exists. Exits 0
# when the repository is healthy (or when there is no repository to check), 1
# otherwise, after alerting $BACKUP_ALERT_EMAIL. Runs from cron (supercronic)
# and by hand (`docker exec ... backup-check`).
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh
# shellcheck source=mail.sh
. /usr/local/lib/backup/mail.sh

BACKUP_DIR=/tmp/backup
CHECK_LOG=$BACKUP_DIR/check.log
# The log notify_failure quotes.
ALERT_LOG=$CHECK_LOG

main() {
  umask 077
  mkdir -p "$BACKUP_DIR"

  if ! restic_enabled; then
    log info "no restic repository configured, nothing to check"
    return 0
  fi

  local status=0
  log info "checking the restic repository" >"$CHECK_LOG"
  restic check >>"$CHECK_LOG" 2>&1 || status=$?
  if [ "$status" -eq 0 ]; then
    log info "the restic repository is healthy" >>"$CHECK_LOG"
  else
    log error "restic check failed (exit status $status)" >>"$CHECK_LOG"
  fi
  cat "$CHECK_LOG"

  if [ "$status" -ne 0 ]; then
    notify_failure "restic check"
    return 1
  fi
}

main "$@"
