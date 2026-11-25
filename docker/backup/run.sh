#!/usr/bin/env bash
# One backup: dump the database once, then ship the dump to every enabled
# destination. Exits 0 when every enabled destination succeeded, 1 otherwise.
# Runs from cron (supercronic) and by hand (`docker exec ... backup-run`).
set -euo pipefail

# shellcheck source=lib.sh
. /usr/local/lib/backup/lib.sh

BACKUP_DIR=/tmp/backup
DUMP=$BACKUP_DIR/bagheera.pgdump
LOCK=$BACKUP_DIR/run.lock
RUN_LOG=$BACKUP_DIR/run.log

# One entry per destination (or step) that failed during this run.
FAILURES=()
TEE_PID=""

# Everything the run prints also goes to $RUN_LOG, truncated at each start.
start_log_capture() {
  exec 3>&1 4>&2
  exec > >(tee "$RUN_LOG") 2>&1
  TEE_PID=$!
}

# Restores the original stdout/stderr and waits for tee, so $RUN_LOG is
# complete (and safe to read) once this returns.
stop_log_capture() {
  [ -n "$TEE_PID" ] || return 0
  exec 1>&3 2>&4 3>&- 4>&-
  wait "$TEE_PID" || true
  TEE_PID=""
}

cleanup() {
  rm -f "$DUMP" "$DUMP.partial"
}

# Dumps the database to $DUMP and checks that pg_restore can read it back. The
# dump only takes its final name once pg_dump exited 0.
dump_database() {
  local host port user db
  host=$(cfg POSTGRES_HOST postgres)
  port=$(cfg POSTGRES_PORT 5432)
  user=$(cfg POSTGRES_USER bagheera)
  db=$(cfg POSTGRES_DB bagheera)

  log info "dumping database $db from $host:$port"
  if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -h "$host" -p "$port" -U "$user" -Fc -d "$db" -f "$DUMP.partial"; then
    log error "pg_dump failed"
    return 1
  fi
  mv "$DUMP.partial" "$DUMP"
  if ! pg_restore -l "$DUMP" >/dev/null; then
    log error "dump verification failed"
    return 1
  fi
  log info "dump verified ($(wc -c <"$DUMP") bytes)"
}

# Pushes the dump to the restic repository, creating the repository only when
# restic says it does not exist, then applies the retention policy. Callers use
# it in a `||` list, where `set -e` is off: every step is checked by hand.
ship_restic() {
  local status=0
  restic cat config >/dev/null || status=$?
  case $status in
    0) ;;
    10)
      restic init --quiet || return 1
      log info "created restic repository"
      ;;
    *)
      log error "restic repository is not usable (restic exit status $status)"
      return 1
      ;;
  esac

  log info "pushing the dump to restic"
  restic backup --tag postgres "$DUMP" || return 1

  restic forget --prune --group-by host --tag postgres \
    --keep-daily "$(cfg BACKUP_KEEP_DAILY 7)" \
    --keep-weekly "$(cfg BACKUP_KEEP_WEEKLY 4)" \
    --keep-monthly "$(cfg BACKUP_KEEP_MONTHLY 6)" || return 1
}

main() {
  umask 077
  mkdir -p "$BACKUP_DIR"

  exec 9>"$LOCK"
  if ! flock -n 9; then
    log error "another backup is already running"
    return 1
  fi
  # Only after the lock: a refused run must not delete the running one's dump.
  trap cleanup EXIT
  trap 'exit 1' INT TERM

  start_log_capture
  log info "backup started"

  if dump_database; then
    if restic_enabled; then
      ship_restic || FAILURES+=("restic")
    fi
  else
    FAILURES+=("dump")
  fi

  if [ "${#FAILURES[@]}" -eq 0 ]; then
    log info "backup finished"
  else
    log error "backup failed: ${FAILURES[*]}"
  fi
  stop_log_capture

  [ "${#FAILURES[@]}" -eq 0 ]
}

main "$@"
