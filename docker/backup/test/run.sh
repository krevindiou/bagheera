#!/usr/bin/env bash
# Backup container tests, run by `make test-backup` inside the built image.
set -euo pipefail

# shellcheck source=helpers.sh
. /tests/helpers.sh

AGE_KEY=$(age-keygen 2>&1 | sed -n 's/^Public key: //p')
RESTIC_ENV=(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=secret BACKUP_ALERT_EMAIL=ops@example.com)

PG_PASSWORD=$POSTGRES_PASSWORD
RUN_ENV=(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw)

# Fixture: a members table with three rows in the postgres service.
seed_database() {
  PGPASSWORD=$PG_PASSWORD psql -h postgres -U bagheera -d bagheera -v ON_ERROR_STOP=1 -q <<'SQL'
SET client_min_messages = warning;
DROP TABLE IF EXISTS members;
CREATE TABLE members (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO members VALUES (1, 'Ada'), (2, 'Grace'), (3, 'Linus');
SQL
}

# Empties the restic repository and every file a previous run left behind.
reset_repo() {
  mkdir -p /tmp/backup
  find /backups -mindepth 1 -delete
  rm -rf /tmp/restore /tmp/backup/run.log /tmp/backup/bagheera.pgdump
}

# Number of snapshots in the repository, read with the given password. When the
# repository cannot be opened it prints nothing and fails, so a comparison with
# a number cannot pass by accident (a command substitution does not stop the
# caller on its own: bash clears `set -e` inside it).
snapshot_count() {
  local json
  json=$(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=${1:-pw} restic snapshots --json) || return 1
  printf '%s\n' "$json" | { grep -o '"short_id"' || true; } | wc -l
}

# Runs backup-run with the default restic variables plus the given overrides.
run_backup() {
  env "${RUN_ENV[@]}" "$@" backup-run
}

# Runs backup-validate with exactly the given variables (and PATH).
validate() {
  env -i PATH="$PATH" "$@" backup-validate
}

test_validate_requires_a_destination() {
  assert_fails "no destination" validate
  assert_contains "$ASSERT_OUTPUT" "no backup destination configured" "message"
}

test_validate_disabled_passes() {
  validate BACKUP_DISABLED=true
}

test_validate_restic_needs_password() {
  assert_fails "restic without password" validate RESTIC_REPOSITORY=/backups
  assert_contains "$ASSERT_OUTPUT" "RESTIC_PASSWORD is required" "message"
}

test_validate_sftp_key_needs_known_hosts() {
  assert_fails "sftp key without known hosts" validate "${RESTIC_ENV[@]}" BACKUP_SFTP_PRIVATE_KEY=key
  assert_contains "$ASSERT_OUTPUT" "BACKUP_SFTP_KNOWN_HOSTS is required" "message"
}

test_validate_email_needs_recipient_key() {
  assert_fails "email without age key" validate BACKUP_EMAIL_TO=me@example.com
  assert_contains "$ASSERT_OUTPUT" "BACKUP_EMAIL_AGE_RECIPIENT is required" "message"
}

test_validate_rejects_invalid_age_key() {
  assert_fails "invalid age key" validate BACKUP_EMAIL_TO=me@example.com BACKUP_EMAIL_AGE_RECIPIENT=not-a-key
  assert_contains "$ASSERT_OUTPUT" "BACKUP_EMAIL_AGE_RECIPIENT is not a valid age recipient" "message"
}

test_validate_rejects_bad_numbers() {
  assert_fails "non-numeric cap" validate "${RESTIC_ENV[@]}" BACKUP_EMAIL_MAX_MB=abc
  assert_contains "$ASSERT_OUTPUT" "BACKUP_EMAIL_MAX_MB must be a positive integer" "cap message"
  assert_fails "zero retention" validate "${RESTIC_ENV[@]}" BACKUP_KEEP_DAILY=0
  assert_contains "$ASSERT_OUTPUT" "BACKUP_KEEP_DAILY must be a positive integer" "retention message"
}

test_validate_rejects_bad_schedule() {
  assert_fails "bad schedule" validate "${RESTIC_ENV[@]}" "BACKUP_SCHEDULE=every day"
  assert_contains "$ASSERT_OUTPUT" "BACKUP_SCHEDULE is not a valid cron expression" "message"
}

test_validate_rejects_bad_report() {
  assert_fails "bad report" validate "${RESTIC_ENV[@]}" BACKUP_REPORT=sometimes
  assert_contains "$ASSERT_OUTPUT" "BACKUP_REPORT must be failure or always" "message"
}

test_validate_warns_without_alert_email() {
  local output
  output=$(validate RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=secret 2>&1)
  assert_contains "$output" "WARN: BACKUP_ALERT_EMAIL is not set" "warning"
}

test_validate_accepts_a_full_valid_config() {
  validate "${RESTIC_ENV[@]}" BACKUP_EMAIL_TO=me@example.com "BACKUP_EMAIL_AGE_RECIPIENT=$AGE_KEY" \
    "BACKUP_SCHEDULE=15 2 * * 1-5" BACKUP_REPORT=always
}

test_restic_backup_creates_restorable_snapshot() {
  reset_repo
  local output snapshots
  output=$(run_backup 2>&1)
  assert_contains "$output" "created restic repository" "first run initialises the repository"
  snapshots=$(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic snapshots --json)
  assert_eq 1 "$(snapshot_count)" "snapshot count"
  assert_contains "$snapshots" '"tags":["postgres"]' "snapshot tag"
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic restore latest --target /tmp/restore --quiet >/dev/null
  local restored
  restored=$(find /tmp/restore -name bagheera.pgdump)
  [ -n "$restored" ] || fail "bagheera.pgdump missing from the restored snapshot"
  assert_contains "$(pg_restore -l "$restored")" "members" "restored dump lists the members table"
  [ ! -e /tmp/backup/bagheera.pgdump ] || fail "the dump was left on disk after the run"
}

test_second_run_adds_snapshot_without_reinit() {
  reset_repo
  run_backup >/dev/null 2>&1
  local output
  output=$(run_backup 2>&1)
  case $output in
    *"created restic repository"*) fail "second run re-initialised the repository" ;;
  esac
  assert_eq 2 "$(snapshot_count)" "snapshot count"
}

# Seeds one snapshot per month of 2020 (four different days, ISO weeks and
# months, all long gone), runs backup-run with the given retention variables and
# prints how many snapshots are left. The run adds a fifth snapshot, today's.
#
# restic keeps the newest snapshot of each of the last N days, plus the oldest
# one of each of the last N weeks and months. So on the same day a retention
# policy cannot prune below two snapshots (first and last), and only snapshots
# on different days tell the --keep-* values apart.
retained_after() {
  local day
  reset_repo
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
  printf 'seed\n' >/tmp/seed.txt
  for day in 2020-01-06 2020-02-03 2020-03-02 2020-04-06; do
    RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic backup --quiet --tag postgres \
      --time "$day 03:00:00" /tmp/seed.txt >/dev/null
  done
  assert_eq 4 "$(snapshot_count)" "seeded snapshots"
  run_backup "$@" >/dev/null 2>&1
  snapshot_count
}

# Without BACKUP_KEEP_WEEKLY/MONTHLY pulling weight (1 each, only today's
# bucket), the 3 most recent days remain: today, 2020-04-06 and 2020-03-02.
test_retention_applies_keep_daily() {
  assert_eq 3 "$(retained_after BACKUP_KEEP_DAILY=3 BACKUP_KEEP_WEEKLY=1 BACKUP_KEEP_MONTHLY=1)" "kept with 3 daily"
}

# Today plus the oldest snapshot of the previous seeded week: 2.
test_retention_applies_keep_weekly() {
  assert_eq 2 "$(retained_after BACKUP_KEEP_DAILY=1 BACKUP_KEEP_WEEKLY=2 BACKUP_KEEP_MONTHLY=1)" "kept with 2 weekly"
}

# Today plus the oldest snapshot of the 2 previous seeded months: 3.
test_retention_applies_keep_monthly() {
  assert_eq 3 "$(retained_after BACKUP_KEEP_DAILY=1 BACKUP_KEEP_WEEKLY=1 BACKUP_KEEP_MONTHLY=3)" "kept with 3 monthly"
}

# The defaults (7 daily, 4 weekly, 6 monthly) keep all five.
test_retention_defaults_keep_recent_snapshots() {
  assert_eq 5 "$(retained_after)" "kept with the defaults"
}

test_failed_dump_ships_nothing() {
  reset_repo
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
  assert_fails "wrong database password" run_backup POSTGRES_PASSWORD=wrong
  assert_contains "$ASSERT_OUTPUT" "pg_dump failed" "message"
  assert_eq 0 "$(snapshot_count)" "snapshot count"
  [ ! -e /tmp/backup/bagheera.pgdump ] || fail "a failed dump was left on disk"
}

test_postgres_unreachable_fails() {
  reset_repo
  assert_fails "unreachable postgres" run_backup POSTGRES_HOST=nowhere
  assert_contains "$ASSERT_OUTPUT" "pg_dump failed" "message"
}

test_wrong_restic_password_fails_without_init() {
  reset_repo
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
  assert_fails "wrong restic password" run_backup RESTIC_PASSWORD=other
  case $ASSERT_OUTPUT in
    *"created restic repository"*) fail "a wrong password triggered an init" ;;
  esac
  assert_contains "$ASSERT_OUTPUT" "restic repository is not usable" "failure branch"
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic snapshots --quiet >/dev/null ||
    fail "the repository no longer opens with its own password"
  assert_eq 0 "$(snapshot_count pw)" "snapshot count"
}

test_overlapping_runs_are_refused() {
  reset_repo
  # Hold the lock the way a running backup does; exec makes $! the holder itself.
  (
    exec 8>/tmp/backup/run.lock
    flock 8
    exec sleep 60
  ) &
  local holder=$!
  local waited=0
  while flock -n /tmp/backup/run.lock true && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  # Double quotes on purpose: the trap fires after the function's locals are gone.
  # shellcheck disable=SC2064
  trap "kill $holder 2>/dev/null || true" EXIT
  assert_fails "overlapping run" run_backup
  assert_contains "$ASSERT_OUTPUT" "another backup is already running" "message"
}

test_run_log_holds_only_the_last_run() {
  reset_repo
  assert_fails "failing run" run_backup POSTGRES_PASSWORD=wrong
  assert_contains "$(cat /tmp/backup/run.log)" "pg_dump failed" "log of the failed run"
  run_backup >/dev/null 2>&1
  local log
  log=$(cat /tmp/backup/run.log)
  assert_contains "$log" "created restic repository" "log of the second run"
  case $log in
    *"pg_dump failed"*) fail "run.log was not truncated at the start of the run" ;;
  esac
}

seed_database
run_tests
