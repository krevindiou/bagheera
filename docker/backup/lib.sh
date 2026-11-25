#!/usr/bin/env bash
# Shared helpers, sourced by every backup script.
set -euo pipefail

# log <info|warn|error> <message...>
log() {
  local level=$1
  shift
  printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${level^^}" "$*"
}

# cfg <NAME> <default>: the value of $NAME, or the default when unset or empty.
cfg() {
  local name=$1 default=$2
  printf '%s\n' "${!name:-$default}"
}

backup_disabled() { [ "${BACKUP_DISABLED:-}" = "true" ]; }
restic_enabled() { [ -n "${RESTIC_REPOSITORY:-}" ]; }
email_enabled() { [ -n "${BACKUP_EMAIL_TO:-}" ]; }
alert_enabled() { [ -n "${BACKUP_ALERT_EMAIL:-}" ]; }
