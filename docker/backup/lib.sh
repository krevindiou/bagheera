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

# The status run_step returns for a step that ran out of time.
STEP_TIMED_OUT=124

# duration_seconds <duration>: a duration as `timeout` takes it (a number,
# optionally followed by s, m, h or d), in seconds. Fails on anything else.
duration_seconds() {
  [[ $1 =~ ^([0-9]+)([smhd]?)$ ]] || return 1
  local n=$((10#${BASH_REMATCH[1]}))
  case ${BASH_REMATCH[2]} in
    m) n=$((n * 60)) ;;
    h) n=$((n * 3600)) ;;
    d) n=$((n * 86400)) ;;
  esac
  printf '%s\n' "$n"
}

# run_step <name> <command> [args...]: runs the command, which gets at most
# BACKUP_STEP_TIMEOUT (default 2h) to finish, so a peer that stops answering
# fails the run instead of hanging it (and its lock) for good. Returns the
# command's status, or $STEP_TIMED_OUT after logging, on stderr so a caller
# that discards the command's output still shows it, that <name> timed out.
run_step() {
  local name=$1 limit seconds start status=0
  shift
  limit=$(cfg BACKUP_STEP_TIMEOUT 2h)
  if ! seconds=$(duration_seconds "$limit") || [ "$seconds" -eq 0 ]; then
    log error "BACKUP_STEP_TIMEOUT must be a positive duration such as 90m or 2h (got '$limit')" >&2
    return 1
  fi
  start=$SECONDS
  # The inner timeout asks the command to stop (SIGTERM, so restic can release
  # its repository lock); the outer one kills it if it is still there a minute
  # later. Not `timeout -k`: busybox's then signals the PID a minute later
  # even when the command is long gone. The run lock (fd 9) is not passed on:
  # a timeout's watcher process can outlive the command by a second, and would
  # keep holding the lock after the run ended.
  timeout -s KILL $((seconds + 60)) timeout "$seconds" "$@" 9>&- || status=$?
  # The status alone cannot tell: busybox's timeout reports the signal, and
  # restic exits 1 when stopped. A failure that took the whole time did time out.
  if [ "$status" -ne 0 ] && [ $((SECONDS - start)) -ge "$seconds" ]; then
    log error "$name timed out after $limit (BACKUP_STEP_TIMEOUT)" >&2
    return "$STEP_TIMED_OUT"
  fi
  return "$status"
}
