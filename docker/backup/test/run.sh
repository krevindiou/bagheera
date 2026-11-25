#!/usr/bin/env bash
# Backup container tests, run by `make test-backup` inside the built image.
# The test_* functions are run by name by the runner loop: ShellCheck sees them
# as never called (SC2329 since 0.11.0, SC2317 before it).
# shellcheck disable=SC2317,SC2329
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
    "BACKUP_SCHEDULE=15 2 * * 1-5" BACKUP_REPORT=always BACKUP_STEP_TIMEOUT=90m
}

# supercronic takes a 6-field expression (seconds first), so only a field
# count tells it from the 5-field one the docs promise.
test_validate_requires_five_schedule_fields() {
  assert_fails "six fields" validate "${RESTIC_ENV[@]}" "BACKUP_SCHEDULE=0 0 3 * * *"
  assert_contains "$ASSERT_OUTPUT" "BACKUP_SCHEDULE must have exactly 5 fields" "message"
}

test_validate_rejects_bad_step_timeout() {
  local value
  for value in abc 2x 0 1.5h -1m '2 h'; do
    assert_fails "BACKUP_STEP_TIMEOUT=$value" validate "${RESTIC_ENV[@]}" "BACKUP_STEP_TIMEOUT=$value"
    assert_contains "$ASSERT_OUTPUT" "BACKUP_STEP_TIMEOUT must be a positive duration" "message for [$value]"
  done
}

test_validate_accepts_step_timeouts() {
  local value
  for value in 90 90s 45m 2h 1d; do
    validate "${RESTIC_ENV[@]}" "BACKUP_STEP_TIMEOUT=$value" >/dev/null 2>&1 || fail "BACKUP_STEP_TIMEOUT=$value was rejected"
  done
}

# Only the backup_data volume at /backups outlives a redeploy.
test_validate_rejects_local_repository_outside_backups() {
  local repo
  for repo in /tmp/restic /backupsx/restic /backups/../tmp/restic; do
    assert_fails "RESTIC_REPOSITORY=$repo" validate RESTIC_REPOSITORY="$repo" RESTIC_PASSWORD=secret
    assert_contains "$ASSERT_OUTPUT" "RESTIC_REPOSITORY must be under /backups" "message for $repo"
  done
  validate RESTIC_REPOSITORY=/backups/restic RESTIC_PASSWORD=secret >/dev/null 2>&1 ||
    fail "a repository under /backups was rejected"
  validate RESTIC_REPOSITORY=s3:https://s3.example.test/bucket/bagheera RESTIC_PASSWORD=secret >/dev/null 2>&1 ||
    fail "a remote repository was rejected"
}

test_validate_reports_unwritable_backups() {
  local mode
  mode=$(stat -c %a /backups)
  # shellcheck disable=SC2064 # the mode is read now, the trap fires later
  trap "chmod $mode /backups" EXIT
  chmod 555 /backups
  assert_fails "read-only /backups" validate RESTIC_REPOSITORY=/backups/restic RESTIC_PASSWORD=secret
  assert_contains "$ASSERT_OUTPUT" "/backups is not writable by the backup user" "message"
}

# curl's --mail-rcpt takes one bare address.
test_validate_requires_single_bare_addresses() {
  local var value
  for var in BACKUP_EMAIL_TO BACKUP_ALERT_EMAIL; do
    for value in 'Ops <ops@example.com>' 'a@example.com,b@example.com' 'a@example.com b@example.com' ops; do
      assert_fails "$var=$value" validate "${RESTIC_ENV[@]}" "BACKUP_EMAIL_AGE_RECIPIENT=$AGE_KEY" "$var=$value"
      assert_contains "$ASSERT_OUTPUT" "$var must be one bare address" "message for $var=$value"
    done
  done
}

# run_step, from lib.sh, under the given BACKUP_STEP_TIMEOUT.
run_step_with() {
  local limit=$1
  shift
  (
    # shellcheck source=../lib.sh
    . /usr/local/lib/backup/lib.sh
    BACKUP_STEP_TIMEOUT=$limit run_step "the step" "$@"
  )
}

test_run_step_stops_a_step_that_runs_too_long() {
  local status=0 started=$SECONDS output
  output=$(run_step_with 1s sleep 30 2>&1) || status=$?
  assert_eq 124 "$status" "status"
  [ $((SECONDS - started)) -lt 10 ] || fail "the step was not stopped in time"
  assert_contains "$output" "ERROR the step timed out after 1s (BACKUP_STEP_TIMEOUT)" "message"
}

test_run_step_passes_the_command_status_through() {
  local status=0 output
  output=$(run_step_with 30s sh -c 'echo out; exit 7' 2>&1) || status=$?
  assert_eq 7 "$status" "status"
  assert_eq out "$output" "output"
}

test_restic_backup_creates_restorable_snapshot() {
  reset_repo
  local output snapshots
  output=$(run_backup 2>&1)
  assert_contains "$output" "created restic repository" "first run initialises the repository"
  # A warning, so a mistyped RESTIC_REPOSITORY stands out in the logs.
  assert_contains "$output" "WARN created restic repository" "the new repository is logged as a warning"
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

# Host names of the snapshots in the repository, one per line, sorted.
snapshot_hosts() {
  local json
  json=$(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic snapshots --json) || return 1
  printf '%s\n' "$json" | { grep -o '"hostname":"[^"]*"' || true; } | sed 's/"hostname":"\(.*\)"/\1/' | sort
}

# Snapshots are recorded under the fixed host name `bagheera`, whatever the
# container's own host name is: retention groups by host, so a host name that
# changed with every deploy would leave every deploy's snapshots unpruned.
test_snapshots_use_the_pinned_host_name() {
  reset_repo
  # Without this the test could not tell a pinned name from the default one.
  [ "$(hostname)" != "bagheera" ] || fail "the test container's host name is bagheera: the test would prove nothing"
  run_backup >/dev/null 2>&1
  assert_eq "bagheera" "$(snapshot_hosts)" "snapshot host name"
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
    RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic backup --quiet --host bagheera --tag postgres \
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

# Retention only considers the snapshots of the pinned host: those another host
# name wrote (the earlier host-side backup, whose snapshots carry the deploy
# host's name) are left alone, and are removed by hand. Two of them, because
# restic's keep rules would keep a lone snapshot of an unpinned group anyway:
# with the old group in play, KEEP_DAILY=1 would drop the older of the two.
test_retention_leaves_other_hosts_snapshots_alone() {
  local day
  reset_repo
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
  printf 'seed\n' >/tmp/seed.txt
  for day in 2020-01-06 2020-02-03; do
    RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic backup --quiet --host old-container-id --tag postgres \
      --time "$day 03:00:00" /tmp/seed.txt >/dev/null
  done
  for day in 2020-03-02 2020-04-06; do
    RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic backup --quiet --host bagheera --tag postgres \
      --time "$day 03:00:00" /tmp/seed.txt >/dev/null
  done
  assert_eq 4 "$(snapshot_count)" "seeded snapshots"
  run_backup BACKUP_KEEP_DAILY=1 BACKUP_KEEP_WEEKLY=1 BACKUP_KEEP_MONTHLY=1 >/dev/null 2>&1
  # The pinned host's seeds obey the keep flags: only today's snapshot is left.
  assert_eq "bagheera
old-container-id
old-container-id" "$(snapshot_hosts)" "snapshot hosts after the run"
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

# Puts in $FAKE_BIN a pg_dump that cuts the last bytes off the dump it writes,
# in the data of the last table, and keeps a copy at /tmp/cut.pgdump. The table
# of contents, at the start of the file, stays readable.
truncating_pg_dump() {
  FAKE_BIN=$(mktemp -d)
  cat >"$FAKE_BIN/pg_dump" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
/usr/local/bin/pg_dump "$@"
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-f" ]; then out=$2; fi
  shift
done
size=$(wc -c <"$out")
head -c "$((size - 32))" "$out" >"$out.cut"
mv "$out.cut" "$out"
cp "$out" /tmp/cut.pgdump
EOF
  chmod +x "$FAKE_BIN/pg_dump"
}

test_dump_cut_short_in_its_data_is_rejected() {
  reset_repo
  init_repo
  rm -f /tmp/cut.pgdump
  truncating_pg_dump
  assert_fails "a dump cut short" run_backup "PATH=$FAKE_BIN:$PATH"
  # Without this the test could not tell reading the data from listing the
  # table of contents.
  pg_restore -l /tmp/cut.pgdump >/dev/null 2>&1 ||
    fail "the cut dump's table of contents is unreadable: the test would prove nothing"
  assert_contains "$ASSERT_OUTPUT" "dump verification failed" "message"
  assert_eq 0 "$(snapshot_count)" "snapshot count"
}

# Holds an exclusive lock on the members table, from a session that then
# sleeps, until release_table_lock (the calling test's EXIT trap): pg_dump has
# to wait for it.
hold_table_lock() {
  PGPASSWORD=$PG_PASSWORD PGAPPNAME=lock-holder psql -h postgres -U bagheera -d bagheera -q >/dev/null 2>&1 <<'SQL' &
BEGIN;
LOCK TABLE members IN ACCESS EXCLUSIVE MODE;
SELECT pg_sleep(30);
SQL
  trap release_table_lock EXIT
  local waited=0
  while [ "$(table_lock_holders)" != 1 ] && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  [ "$(table_lock_holders)" = 1 ] || fail "the lock holder never locked the members table"
}

table_lock_holders() {
  PGPASSWORD=$PG_PASSWORD psql -h postgres -U bagheera -d bagheera -qAt -c \
    "SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING (pid)
     WHERE a.application_name = 'lock-holder' AND l.mode = 'AccessExclusiveLock' AND l.granted"
}

release_table_lock() {
  PGPASSWORD=$PG_PASSWORD psql -h postgres -U bagheera -d bagheera -qAt -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'lock-holder'" >/dev/null
}

# A dump stuck behind a lock ends at BACKUP_STEP_TIMEOUT, as a failure that
# alerts and says it timed out. In this test and the two below, the outer
# timeout turns a regression (a run that waits on) into a failure rather than a
# hang: SIGKILL, because the run would wait for its step before acting on
# SIGTERM.
test_dump_stuck_behind_a_lock_times_out() {
  reset_repo
  mailpit_reset
  hold_table_lock
  local status=0 started=$SECONDS body
  timeout -s KILL 60 env "${RUN_ENV[@]}" "${ALERT_ENV[@]}" BACKUP_STEP_TIMEOUT=3s backup-run >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  [ $((SECONDS - started)) -lt 20 ] || fail "the run took $((SECONDS - started))s"
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "The Bagheera backup failed: dump (timed out)." "the headline"
  assert_contains "$body" "pg_dump timed out after 3s (BACKUP_STEP_TIMEOUT)" "the log tail"
}

# Listens on port 18000 and never answers: a repository server gone silent
# (restic, which retries for minutes, would hang on a refused connection too).
# Stopped when the calling test ends.
SILENT_REPOSITORY=rest:http://127.0.0.1:18000/
start_silent_peer() {
  sleep 60 | nc -l -p 18000 >/dev/null 2>&1 &
  # shellcheck disable=SC2064 # $! is the listener now
  trap "kill $! 2>/dev/null || true" EXIT
  sleep 0.5
}

test_hung_restic_step_times_out_and_alerts() {
  reset_repo
  mailpit_reset
  start_silent_peer
  local status=0 started=$SECONDS body
  timeout -s KILL 60 env "${RUN_ENV[@]}" "${ALERT_ENV[@]}" RESTIC_REPOSITORY="$SILENT_REPOSITORY" BACKUP_STEP_TIMEOUT=3s \
    backup-run >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  [ $((SECONDS - started)) -lt 20 ] || fail "the run took $((SECONDS - started))s"
  assert_eq 1 "$(mailpit_count '[Bagheera backup] FAILED')" "alert count"
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "The Bagheera backup failed: restic (timed out)." "the headline"
  assert_contains "$body" "restic cat config timed out after 3s (BACKUP_STEP_TIMEOUT)" "the log tail"
}

test_hung_check_times_out_and_alerts() {
  mailpit_reset
  start_silent_peer
  local status=0 started=$SECONDS
  timeout -s KILL 60 env "${RUN_ENV[@]}" "${ALERT_ENV[@]}" RESTIC_REPOSITORY="$SILENT_REPOSITORY" BACKUP_STEP_TIMEOUT=3s \
    backup-check >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  [ $((SECONDS - started)) -lt 20 ] || fail "the check took $((SECONDS - started))s"
  assert_contains "$(mailpit_body '[Bagheera backup] FAILED')" "The Bagheera backup failed: restic check (timed out)." "the headline"
}

# The snapshot is in, only the pruning failed: the alert must not read as if
# no backup was taken.
test_failed_retention_is_its_own_failure() {
  reset_repo
  mailpit_reset
  local status=0 body
  run_backup "${ALERT_ENV[@]}" BACKUP_KEEP_DAILY=not-a-number >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  assert_eq 1 "$(snapshot_count)" "snapshot count"
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "The Bagheera backup failed: restic-retention." "the headline"
  assert_contains "$body" "the snapshot is saved, but applying the retention policy failed" "the log tail"
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

# Email fixtures. The URL's password is percent-encoded on purpose: curl must
# decode the userinfo before authenticating.
EMAIL_SMTP_URL='smtp://user:p%40ss@mailpit:1025'
EMAIL_ENV=(
  "EMAIL_SMTP_URL=$EMAIL_SMTP_URL"
  EMAIL_FROM=backup@example.test
  BACKUP_SMTP_ALLOW_PLAINTEXT=true
  BACKUP_EMAIL_TO=ops@example.test
)

# Generates an age key pair in a fresh temp dir: $AGE_KEY_FILE holds the
# private key, $AGE_RECIPIENT the public one. Call it directly, not in a command
# substitution, so the variables reach the test.
new_age_key() {
  AGE_KEY_FILE=$(mktemp -d)/key.txt
  age-keygen -o "$AGE_KEY_FILE" 2>/dev/null
  AGE_RECIPIENT=$(age-keygen -y "$AGE_KEY_FILE")
}

# Runs backup-run with the email destination only (no restic), after
# new_age_key, plus the given overrides.
run_email_backup() {
  env "${EMAIL_ENV[@]}" "BACKUP_EMAIL_AGE_RECIPIENT=$AGE_RECIPIENT" "$@" backup-run
}

# Adds a table of incompressible rows (about 4 MB once dumped) and drops it
# again when the calling test ends, whatever its outcome.
seed_big_table() {
  PGPASSWORD=$PG_PASSWORD psql -h postgres -U bagheera -d bagheera -v ON_ERROR_STOP=1 -q <<'SQL'
SET client_min_messages = warning;
DROP TABLE IF EXISTS filler;
CREATE TABLE filler AS
  SELECT md5(random()::text) || md5(random()::text) AS v FROM generate_series(1, 120000);
SQL
  trap 'PGPASSWORD=$PG_PASSWORD psql -h postgres -U bagheera -d bagheera -q -c "DROP TABLE IF EXISTS filler"' EXIT
}

test_email_attachment_decrypts_to_valid_dump() {
  reset_repo
  mailpit_reset
  new_age_key
  run_email_backup >/dev/null 2>&1
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "message count"
  local name
  name=$(mailpit_attachment_name '[Bagheera backup]')
  [[ $name =~ ^bagheera-[0-9]{4}-[0-9]{2}-[0-9]{2}\.pgdump\.age$ ]] || fail "attachment name [$name]"
  assert_contains "$name" "$(date -u +%F)" "attachment name carries today's date"
  mailpit_download_attachment '[Bagheera backup]' /tmp/attachment.age
  age -d -i "$AGE_KEY_FILE" -o /tmp/attachment.pgdump /tmp/attachment.age
  assert_contains "$(pg_restore -l /tmp/attachment.pgdump)" "members" "decrypted attachment lists the members table"
  [ -z "$(ls /tmp/backup/*.age 2>/dev/null)" ] || fail "the encrypted file was left on disk after the run"
  [ ! -e /tmp/backup/bagheera.pgdump ] || fail "the dump was left on disk after the run"
}

test_email_subject_reports_the_date_and_size() {
  reset_repo
  mailpit_reset
  new_age_key
  run_email_backup >/dev/null 2>&1
  assert_eq 1 "$(mailpit_count "[Bagheera backup] $(date -u +%F) (")" "subject with the date"
  mailpit_download_attachment '[Bagheera backup]' /tmp/attachment.age
  local kib
  kib=$(( ($(wc -c </tmp/attachment.age) + 1023) / 1024 ))
  assert_eq 1 "$(mailpit_count " ($kib KiB)")" "subject size is the attachment size in KiB"
}

test_email_over_cap_fails_without_sending() {
  reset_repo
  mailpit_reset
  new_age_key
  seed_big_table
  assert_fails "dump over the cap" run_email_backup BACKUP_EMAIL_MAX_MB=1
  assert_contains "$ASSERT_OUTPUT" "exceeds BACKUP_EMAIL_MAX_MB" "message"
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
  [ -z "$(ls /tmp/backup/*.age 2>/dev/null)" ] || fail "the encrypted file was left on disk after the run"
}

test_email_requires_tls_by_default() {
  reset_repo
  mailpit_reset
  new_age_key
  assert_fails "plain SMTP without the opt-in" run_email_backup BACKUP_SMTP_ALLOW_PLAINTEXT=
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
  case $ASSERT_OUTPUT in
    *p%40ss* | *p@ss*) fail "the SMTP password leaked into the output" ;;
  esac
}

# The STARTTLS Mailpit, with a certificate made for this run: curl trusts it
# through CURL_CA_BUNDLE, as it trusts the system's CAs in production.
TLS_SMTP_URL='smtp://user:p%40ss@mailpit-tls:1025'

test_email_over_starttls_is_delivered() {
  reset_repo
  local MAILPIT_URL=$MAILPIT_TLS_URL
  mailpit_reset
  new_age_key
  # The server refuses plain SMTP, so a delivery below proves STARTTLS.
  assert_fails "plain SMTP to the STARTTLS server" run_email_backup "EMAIL_SMTP_URL=$TLS_SMTP_URL" CURL_CA_BUNDLE=/certs/cert.pem
  local output
  output=$(run_email_backup BACKUP_SMTP_ALLOW_PLAINTEXT= "EMAIL_SMTP_URL=$TLS_SMTP_URL" CURL_CA_BUNDLE=/certs/cert.pem 2>&1) ||
    fail "the backup failed over STARTTLS: $output"
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "message count"
  mailpit_download_attachment '[Bagheera backup]' /tmp/attachment.age
  age -d -i "$AGE_KEY_FILE" -o /tmp/attachment.pgdump /tmp/attachment.age
  assert_contains "$(pg_restore -l /tmp/attachment.pgdump)" "members" "decrypted attachment lists the members table"
}

test_email_over_starttls_checks_the_certificate() {
  reset_repo
  local MAILPIT_URL=$MAILPIT_TLS_URL
  mailpit_reset
  new_age_key
  assert_fails "an untrusted certificate" run_email_backup BACKUP_SMTP_ALLOW_PLAINTEXT= "EMAIL_SMTP_URL=$TLS_SMTP_URL"
  assert_contains "$ASSERT_OUTPUT" "sending the email failed" "message"
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

test_email_is_never_plaintext() {
  reset_repo
  mailpit_reset
  new_age_key
  run_email_backup >/dev/null 2>&1
  mailpit_download_attachment '[Bagheera backup]' /tmp/attachment.age
  # The probe is only meaningful if the clear-text dump does contain the table
  # name: check that on the decrypted copy.
  age -d -i "$AGE_KEY_FILE" -o /tmp/attachment.pgdump /tmp/attachment.age
  grep -q members /tmp/attachment.pgdump || fail "the decrypted dump does not mention the members table"
  if grep -q members /tmp/attachment.age; then fail "the attachment contains the table name in clear"; fi
  if grep -q PGDMP /tmp/attachment.age; then fail "the attachment starts like a clear-text pg_dump archive"; fi
}

test_email_from_with_display_name() {
  reset_repo
  mailpit_reset
  new_age_key
  run_email_backup 'EMAIL_FROM=Bagheera <backup@example.test>' >/dev/null 2>&1
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "message count"
  assert_contains "$(mailpit_raw '[Bagheera backup]')" 'From: Bagheera <backup@example.test>' "From header is EMAIL_FROM verbatim"
  assert_eq backup@example.test "$(mailpit_envelope_sender '[Bagheera backup]')" "envelope sender"
}

test_email_from_bare_address_is_the_envelope_sender() {
  reset_repo
  mailpit_reset
  new_age_key
  run_email_backup >/dev/null 2>&1
  assert_eq backup@example.test "$(mailpit_envelope_sender '[Bagheera backup]')" "envelope sender"
}

test_one_destination_failing_does_not_skip_the_other() {
  reset_repo
  mailpit_reset
  new_age_key
  seed_big_table
  assert_fails "email over the cap" run_email_backup BACKUP_EMAIL_MAX_MB=1 "${RUN_ENV[@]}"
  assert_contains "$ASSERT_OUTPUT" "exceeds BACKUP_EMAIL_MAX_MB" "email failure"
  assert_contains "$ASSERT_OUTPUT" "backup failed: email" "only the email failed"
  assert_eq 1 "$(snapshot_count)" "restic snapshot count"
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

test_restic_failing_does_not_skip_email() {
  reset_repo
  mailpit_reset
  new_age_key
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
  assert_fails "wrong restic password" run_email_backup "${RUN_ENV[@]}" RESTIC_PASSWORD=other
  assert_contains "$ASSERT_OUTPUT" "backup failed: restic" "only restic failed"
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "message count"
}

# Alert fixtures: SMTP configured and an alert address, no email destination.
ALERT_ENV=(
  "EMAIL_SMTP_URL=$EMAIL_SMTP_URL"
  EMAIL_FROM=backup@example.test
  BACKUP_SMTP_ALLOW_PLAINTEXT=true
  BACKUP_ALERT_EMAIL=alerts@example.test
)

# Runs backup-check against the default repository with the given overrides.
run_check() {
  env "${RUN_ENV[@]}" "$@" backup-check
}

# A repository that already exists, so a wrong password fails the restic step
# instead of creating a new repository.
init_repo() {
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic init --quiet
}

test_failure_sends_alert() {
  reset_repo
  mailpit_reset
  init_repo
  local status=0 body
  run_backup "${ALERT_ENV[@]}" RESTIC_PASSWORD=wrong-restic-secret >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  assert_eq 1 "$(mailpit_count '[Bagheera backup] FAILED')" "alert count"
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "total message count"
  assert_contains "$(mailpit_raw '[Bagheera backup] FAILED')" 'To: alerts@example.test' "recipient"
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "The Bagheera backup failed: restic." "the failed destination"
  assert_contains "$body" "restic repository is not usable" "the log tail"
  assert_contains "$body" "ERROR backup failed: restic" "the last line of the log"
  case $body in
    *wrong-restic-secret*) fail "the alert leaked RESTIC_PASSWORD" ;;
  esac
}

test_alert_lists_every_failure() {
  reset_repo
  mailpit_reset
  new_age_key
  init_repo
  local status=0
  run_email_backup "${RUN_ENV[@]}" "${ALERT_ENV[@]}" RESTIC_PASSWORD=other BACKUP_EMAIL_MAX_MB=0 >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  assert_eq 1 "$(mailpit_count '[Bagheera backup] FAILED')" "alert count"
  assert_contains "$(mailpit_body '[Bagheera backup] FAILED')" "restic, email" "both destinations"
}

test_dump_failure_sends_alert() {
  reset_repo
  mailpit_reset
  local status=0
  run_backup "${ALERT_ENV[@]}" POSTGRES_PASSWORD=wrong >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  assert_eq 1 "$(mailpit_count '[Bagheera backup] FAILED')" "alert count"
  assert_contains "$(mailpit_body '[Bagheera backup] FAILED')" "dump" "the failed step"
}

test_no_alert_email_means_log_only() {
  reset_repo
  mailpit_reset
  init_repo
  local status=0 output
  output=$(run_backup "${ALERT_ENV[@]}" BACKUP_ALERT_EMAIL= RESTIC_PASSWORD=other 2>&1) || status=$?
  assert_eq 1 "$status" "exit status"
  assert_contains "$output" "backup failed: restic" "the failure is logged"
  case $output in
    *"notification"*) fail "a notification was attempted without BACKUP_ALERT_EMAIL" ;;
  esac
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

test_success_is_silent_by_default() {
  reset_repo
  mailpit_reset
  run_backup "${ALERT_ENV[@]}" >/dev/null 2>&1
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

test_report_always_sends_ok() {
  reset_repo
  mailpit_reset
  run_backup "${ALERT_ENV[@]}" BACKUP_REPORT=always >/dev/null 2>&1
  assert_eq 1 "$(mailpit_count '[Bagheera backup] OK')" "report count"
  assert_eq 1 "$(mailpit_count '[Bagheera backup]')" "total message count"
  assert_contains "$(mailpit_raw '[Bagheera backup] OK')" 'To: alerts@example.test' "recipient"
  assert_contains "$(mailpit_body '[Bagheera backup] OK')" "backup finished" "the log tail"
}

test_report_always_without_alert_email_is_silent() {
  reset_repo
  mailpit_reset
  local output
  output=$(run_backup "${ALERT_ENV[@]}" BACKUP_ALERT_EMAIL= BACKUP_REPORT=always 2>&1)
  case $output in
    *"notification"*) fail "a report was attempted without BACKUP_ALERT_EMAIL" ;;
  esac
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

test_failing_alert_only_changes_the_log() {
  reset_repo
  mailpit_reset
  init_repo
  local status=0 output
  output=$(run_backup "${ALERT_ENV[@]}" EMAIL_SMTP_URL=smtp://nobody:hunter2@nowhere:1025 RESTIC_PASSWORD=other 2>&1) || status=$?
  assert_eq 1 "$status" "a failed run still exits 1"
  assert_contains "$output" "sending the email failed" "the alert failure is logged"
  case $output in
    *hunter2*) fail "the SMTP password leaked into the output" ;;
  esac
  # A successful run stays successful when its report cannot be sent.
  reset_repo
  status=0
  output=$(run_backup "${ALERT_ENV[@]}" EMAIL_SMTP_URL=smtp://nobody:hunter2@nowhere:1025 BACKUP_REPORT=always 2>&1) || status=$?
  assert_eq 0 "$status" "a successful run still exits 0"
  assert_contains "$output" "sending the email failed" "the report failure is logged"
}

# Sends a failure alert quoting a fabricated log, from the real notify_failure.
# The log's 30 numbered lines are followed by one holding every secret.
send_alert_for_fake_log() {
  mailpit_reset
  local log=/tmp/alert-test.log i
  : >"$log"
  for i in $(seq -w 1 30); do
    printf 'log line %s\n' "$i" >>"$log"
  done
  printf 'secrets: %s %s %s\n' "restic-pw-s3cret" "pg-pw-s3cret" "$EMAIL_SMTP_URL" >>"$log"
  send_alert_quoting "$log" RESTIC_PASSWORD=restic-pw-s3cret POSTGRES_PASSWORD=pg-pw-s3cret
}

# send_alert_quoting <log> [VAR=value...]: the real notify_failure, quoting the
# given log, with ALERT_ENV and the given variables in its environment.
send_alert_quoting() {
  local log=$1
  shift
  (
    # shellcheck disable=SC2163 # "$@" holds VAR=value assignments to export
    export "${ALERT_ENV[@]}" "$@"
    # shellcheck source=../mail.sh
    . /usr/local/lib/backup/mail.sh
    # shellcheck disable=SC2034 # read by notify_failure
    ALERT_LOG=$log
    notify_failure dump
  )
}

test_alert_quotes_the_last_20_log_lines() {
  send_alert_for_fake_log
  local body
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "secrets:" "the newest line"
  assert_contains "$body" "log line 12" "the 20th line from the end"
  case $body in
    *"log line 11"*) fail "the alert quotes more than 20 lines" ;;
  esac
}

test_alert_redacts_secrets() {
  send_alert_for_fake_log
  local body
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "secrets: <redacted> <redacted> <redacted>" "the redacted line"
  case $body in
    *restic-pw-s3cret* | *pg-pw-s3cret* | *p%40ss*) fail "the alert leaked a secret" ;;
  esac
}

# The log holds the S3 secret and the SFTP key without its first two lines, as
# a 20-line tail cut through the key would.
test_alert_redacts_the_s3_secret_and_the_sftp_key() {
  mailpit_reset
  local key_dir key log=/tmp/alert-keys.log body line
  key_dir=$(mktemp -d)
  ssh-keygen -q -t ed25519 -N '' -f "$key_dir/id" >/dev/null
  key=$(cat "$key_dir/id")
  {
    printf 'aws: %s\n' aws-s3cret-key
    sed 1,2d "$key_dir/id"
  } >"$log"
  send_alert_quoting "$log" AWS_SECRET_ACCESS_KEY=aws-s3cret-key "BACKUP_SFTP_PRIVATE_KEY=$key"
  body=$(mailpit_body '[Bagheera backup] FAILED')
  assert_contains "$body" "aws: <redacted>" "the S3 secret"
  case $body in
    *aws-s3cret-key*) fail "the alert leaked AWS_SECRET_ACCESS_KEY" ;;
  esac
  while IFS= read -r line; do
    case $line in "" | -----*) continue ;; esac
    case $body in
      *"$line"*) fail "the alert leaked a line of BACKUP_SFTP_PRIVATE_KEY: $line" ;;
    esac
  done <<<"$key"
}

test_check_passes_on_healthy_repo() {
  reset_repo
  mailpit_reset
  run_backup >/dev/null 2>&1
  run_check "${ALERT_ENV[@]}" >/dev/null 2>&1
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

# `restic check` without --read-data must notice a pack the index lists but the
# repository no longer holds.
test_check_detects_corruption() {
  reset_repo
  mailpit_reset
  run_backup >/dev/null 2>&1
  run_check >/dev/null 2>&1 || fail "the check failed on a healthy repository"
  local pack status=0
  pack=$(find /backups/data -type f -print -quit)
  [ -n "$pack" ] || fail "no pack file under /backups/data"
  rm "$pack"
  run_check >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status without an alert address"
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count without an alert address"
  status=0
  run_check "${ALERT_ENV[@]}" >/dev/null 2>&1 || status=$?
  assert_eq 1 "$status" "exit status"
  assert_eq 1 "$(mailpit_count '[Bagheera backup] FAILED')" "alert count"
  assert_contains "$(mailpit_body '[Bagheera backup] FAILED')" "restic check" "the failed step"
}

test_check_without_restic_has_nothing_to_do() {
  mailpit_reset
  local output
  output=$(env "${ALERT_ENV[@]}" backup-check 2>&1)
  assert_contains "$output" "nothing to check" "message"
  assert_eq 0 "$(mailpit_count '[Bagheera backup]')" "message count"
}

# Runs `backup-entrypoint --prepare` with exactly the given variables (and PATH),
# with $PREPARE_HOME as the home directory so ~/.ssh stays out of the real one.
# Call prepare_home first.
prepare_home() {
  PREPARE_HOME=$(mktemp -d)
  rm -f /tmp/backup/crontab
}

entrypoint_prepare() {
  env -i PATH="$PATH" HOME="$PREPARE_HOME" "$@" backup-entrypoint --prepare
}

test_entrypoint_refuses_invalid_config() {
  prepare_home
  assert_fails "no destination" entrypoint_prepare
  assert_contains "$ASSERT_OUTPUT" "no backup destination configured" "message"
  [ ! -e /tmp/backup/crontab ] || fail "a crontab was written for an invalid configuration"
}

test_entrypoint_renders_crontab() {
  prepare_home
  entrypoint_prepare "${RESTIC_ENV[@]}" "BACKUP_SCHEDULE=15 2 * * *" >/dev/null 2>&1
  assert_eq 2 "$(wc -l </tmp/backup/crontab)" "crontab line count"
  assert_eq "15 2 * * * backup-run" "$(sed -n 1p /tmp/backup/crontab)" "backup line"
  assert_eq "30 4 * * 0 backup-check" "$(sed -n 2p /tmp/backup/crontab)" "weekly check line"
  supercronic -test /tmp/backup/crontab >/dev/null 2>&1 || fail "supercronic rejects the generated crontab"
}

test_entrypoint_defaults_to_a_nightly_backup() {
  prepare_home
  entrypoint_prepare "${RESTIC_ENV[@]}" >/dev/null 2>&1
  assert_eq "0 3 * * * backup-run" "$(sed -n 1p /tmp/backup/crontab)" "default schedule"
}

test_entrypoint_omits_check_without_restic() {
  prepare_home
  entrypoint_prepare BACKUP_EMAIL_TO=me@example.com "BACKUP_EMAIL_AGE_RECIPIENT=$AGE_KEY" "BACKUP_SCHEDULE=15 2 * * *" >/dev/null 2>&1
  assert_eq 1 "$(wc -l </tmp/backup/crontab)" "crontab line count"
  assert_eq "15 2 * * * backup-run" "$(cat /tmp/backup/crontab)" "backup line"
}

test_entrypoint_writes_sftp_material() {
  prepare_home
  local key_dir known_hosts='[sftp.example.test]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPinnedHostKeyForTheTest'
  key_dir=$(mktemp -d)
  ssh-keygen -q -t ed25519 -N '' -f "$key_dir/id" >/dev/null
  # $(...) drops the trailing newline, as a value read from an env file may lack it.
  local private_key
  private_key=$(cat "$key_dir/id")
  entrypoint_prepare "${RESTIC_ENV[@]}" "BACKUP_SFTP_PRIVATE_KEY=$private_key" "BACKUP_SFTP_KNOWN_HOSTS=$known_hosts" >/dev/null 2>&1
  local ssh_dir=$PREPARE_HOME/.ssh
  assert_eq 600 "$(stat -c %a "$ssh_dir/id_backup")" "private key mode"
  assert_eq 700 "$(stat -c %a "$ssh_dir")" ".ssh mode"
  assert_eq "$known_hosts" "$(cat "$ssh_dir/known_hosts")" "known_hosts content"
  local config
  config=$(cat "$ssh_dir/config")
  assert_contains "$config" "IdentityFile $ssh_dir/id_backup" "identity file"
  assert_contains "$config" "UserKnownHostsFile $ssh_dir/known_hosts" "known hosts file"
  assert_contains "$config" "StrictHostKeyChecking yes" "host key checking"
  assert_contains "$config" "BatchMode yes" "batch mode"
  # A server gone silent drops the connection after 4 unanswered 30 s probes.
  assert_contains "$config" "ServerAliveInterval 30" "keepalive interval"
  assert_contains "$config" "ServerAliveCountMax 4" "keepalive count"
  ssh -G -F "$ssh_dir/config" sftp.example.test 2>/dev/null | grep -qx 'serveraliveinterval 30' ||
    fail "ssh does not read the keepalive interval from the config"
  assert_eq "$(ssh-keygen -y -f "$key_dir/id")" "$(ssh-keygen -y -f "$ssh_dir/id_backup")" "the written key is the given key and ssh accepts it"
}

test_entrypoint_never_prints_the_private_key() {
  prepare_home
  local output
  output=$(entrypoint_prepare "${RESTIC_ENV[@]}" "BACKUP_SFTP_PRIVATE_KEY=top-secret-key-material" "BACKUP_SFTP_KNOWN_HOSTS=host ssh-ed25519 AAAA" 2>&1)
  case $output in
    *top-secret-key-material*) fail "the private key leaked into the output" ;;
  esac
}

test_entrypoint_without_sftp_key_writes_no_ssh_material() {
  prepare_home
  entrypoint_prepare "${RESTIC_ENV[@]}" >/dev/null 2>&1
  [ ! -e "$PREPARE_HOME/.ssh" ] || fail "\$HOME/.ssh was created without BACKUP_SFTP_PRIVATE_KEY"
}

# busybox's timeout reports 143, not 124, for a child its signal ended, and the
# entrypoint ends cleanly on SIGTERM, so check by hand that it is still running
# after a while and that SIGTERM stops it.
test_disabled_mode_stays_up_and_healthy() {
  env -i PATH="$PATH" HOME="$(mktemp -d)" BACKUP_DISABLED=true backup-entrypoint >/tmp/disabled.log 2>&1 &
  local pid=$! waited=0
  # shellcheck disable=SC2064
  trap "kill $pid 2>/dev/null || true" EXIT
  sleep 1
  kill -0 "$pid" 2>/dev/null || fail "backup-entrypoint exited in disabled mode"
  env -i PATH="$PATH" BACKUP_DISABLED=true backup-healthcheck
  assert_contains "$(cat /tmp/disabled.log)" "WARN" "level"
  assert_contains "$(cat /tmp/disabled.log)" "BACKUP_DISABLED" "message"
  local sleeper
  sleeper=$(pgrep -P "$pid") || fail "the entrypoint has no sleeping child"
  kill -TERM "$pid"
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  ! kill -0 "$pid" 2>/dev/null || fail "SIGTERM did not stop the disabled-mode entrypoint"
  ! kill -0 "$sleeper" 2>/dev/null || fail "the sleeping child outlived the entrypoint"
}

# `backup-entrypoint <command>` runs the command instead of the scheduler: the
# x-pre_deploy hook is `backup-validate` as the container's command, which the
# image's entrypoint receives as an argument. The timeout makes a regression
# (supercronic, or disabled mode's sleep, never exiting) a failure, not a hang;
# busybox's timeout exits 143 when it had to kill the command.
# Usage: entrypoint_command [VAR=value...] <command> [args...]
entrypoint_command() {
  local -a vars=()
  while [[ ${1:-} == *=* ]]; do
    vars+=("$1")
    shift
  done
  env -i PATH="$PATH" HOME="$PREPARE_HOME" "${vars[@]}" timeout 10 backup-entrypoint "$@"
}

test_entrypoint_runs_validate_and_exits() {
  prepare_home
  entrypoint_command "${RESTIC_ENV[@]}" backup-validate >/dev/null 2>&1
  ! pgrep -x supercronic >/dev/null || fail "the scheduler was started"
  [ ! -e /tmp/backup/crontab ] || fail "a crontab was written: the entrypoint did not dispatch"
}

test_entrypoint_validate_command_reports_invalid_config() {
  prepare_home
  local status=0
  ASSERT_OUTPUT=$(entrypoint_command backup-validate 2>&1) || status=$?
  assert_eq 1 "$status" "exit status"
  assert_contains "$ASSERT_OUTPUT" "no backup destination configured" "message"
}

test_entrypoint_validate_command_exits_in_disabled_mode() {
  prepare_home
  # Disabled mode ends cleanly (status 0) on the timeout's SIGTERM, so only the
  # elapsed time tells a command that returned from one that was killed.
  local start=$SECONDS
  entrypoint_command BACKUP_DISABLED=true backup-validate >/dev/null 2>&1
  [ $((SECONDS - start)) -lt 5 ] || fail "backup-validate did not return promptly in disabled mode"
}

test_entrypoint_runs_any_command_given() {
  prepare_home
  local status=0
  ASSERT_OUTPUT=$(entrypoint_command "${RESTIC_ENV[@]}" sh -c 'echo ran-dispatched; exit 7' 2>&1) || status=$?
  assert_eq 7 "$status" "the command's exit status"
  assert_eq "ran-dispatched" "$ASSERT_OUTPUT" "the command's output"
}

test_healthcheck_fails_without_scheduler() {
  assert_fails "no supercronic running" env -i PATH="$PATH" "${RESTIC_ENV[@]}" backup-healthcheck
}

# The real entrypoint: it must become supercronic (so docker's signals reach it),
# the healthcheck must then pass, and SIGTERM must stop it.
test_entrypoint_execs_the_scheduler() {
  prepare_home
  env -i PATH="$PATH" HOME="$PREPARE_HOME" "${RESTIC_ENV[@]}" backup-entrypoint >/dev/null 2>&1 &
  local pid=$! waited=0
  # shellcheck disable=SC2064
  trap "kill $pid 2>/dev/null || true" EXIT
  while ! pgrep -x supercronic >/dev/null && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  assert_eq supercronic "$(cat "/proc/$pid/comm")" "the entrypoint process became supercronic"
  env -i PATH="$PATH" "${RESTIC_ENV[@]}" backup-healthcheck
  kill -TERM "$pid"
  waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  ! kill -0 "$pid" 2>/dev/null || fail "SIGTERM did not stop the scheduler"
}

# Holds a non-exclusive lock on the restic repository until $RELEASE exists (a
# restic backup whose source command waits for the file). Prints nothing; waits
# until the lock is on disk. `restic forget --prune` and `restic check` need an
# exclusive lock, so both conflict with it.
hold_restic_lock() {
  RELEASE=/tmp/release-restic-lock
  rm -f "$RELEASE"
  RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=pw restic backup --quiet --stdin --stdin-from-command --tag holder -- \
    sh -c "while [ ! -e $RELEASE ]; do sleep 0.1; done; echo held" >/dev/null 2>&1 &
  HOLDER=$!
  # shellcheck disable=SC2064
  trap "touch $RELEASE; kill $HOLDER 2>/dev/null || true" EXIT
  local waited=0
  while [ -z "$(ls /backups/locks 2>/dev/null)" ] && [ "$waited" -lt 100 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  [ -n "$(ls /backups/locks)" ] || fail "the holder never took the repository lock"
}

# Releases the lock $delay seconds from now, from a background process.
release_restic_lock_in() {
  (sleep "$1"; touch "$RELEASE") &
}

test_backup_waits_for_a_held_restic_lock() {
  reset_repo
  init_repo
  hold_restic_lock
  release_restic_lock_in 3
  local started=$SECONDS output
  output=$(run_backup 2>&1) || fail "the backup failed instead of waiting for the lock: $output"
  [ $((SECONDS - started)) -ge 2 ] || fail "the backup finished before the lock was released, so it never had to wait"
  wait "$HOLDER"
  assert_eq 2 "$(snapshot_count)" "snapshots: the holder's and the backup's"
}

test_check_waits_for_a_held_restic_lock() {
  reset_repo
  init_repo
  hold_restic_lock
  release_restic_lock_in 3
  local started=$SECONDS output
  output=$(run_check 2>&1) || fail "the check failed instead of waiting for the lock: $output"
  [ $((SECONDS - started)) -ge 2 ] || fail "the check finished before the lock was released, so it never had to wait"
}

seed_database
run_tests
