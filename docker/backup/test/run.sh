#!/usr/bin/env bash
# Backup container tests, run by `make test-backup` inside the built image.
set -euo pipefail

# shellcheck source=helpers.sh
. /tests/helpers.sh

AGE_KEY=$(age-keygen 2>&1 | sed -n 's/^Public key: //p')
RESTIC_ENV=(RESTIC_REPOSITORY=/backups RESTIC_PASSWORD=secret BACKUP_ALERT_EMAIL=ops@example.com)

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

run_tests
