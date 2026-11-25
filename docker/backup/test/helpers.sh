#!/usr/bin/env bash
# Minimal test harness: assertions plus a runner for every `test_*` function.
set -euo pipefail

FAILED=0
ASSERT_OUTPUT=""

# Each test runs in its own subshell, so a failed assertion ends that test
# right there, whatever statement follows it.
fail() {
  printf '  assertion failed: %s\n' "$*" >&2
  exit 1
}

assert_eq() {
  local expected=$1 actual=$2 label=$3
  [ "$expected" = "$actual" ] || fail "$label: expected [$expected], got [$actual]"
}

assert_contains() {
  local haystack=$1 needle=$2 label=$3
  case $haystack in
    *"$needle"*) ;;
    *) fail "$label: [$needle] not found in [$haystack]" ;;
  esac
}

# Passes when the command exits non-zero; its stdout and stderr end up in
# $ASSERT_OUTPUT.
assert_fails() {
  local label=$1
  shift
  local status=0
  ASSERT_OUTPUT=$("$@" 2>&1) || status=$?
  [ "$status" -ne 0 ] || fail "$label: command succeeded, expected a failure"
}

# Mailpit v1 REST API, see $MAILPIT_URL/api/v1. Every helper that prints a value
# fails (and prints nothing) when the API is unreachable or the answer is not
# the expected single message, since a command substitution does not stop the
# caller on its own.

mailpit_reset() {
  curl -fsS -X DELETE "$MAILPIT_URL/api/v1/messages" >/dev/null
}

# ids of the messages whose subject contains $1, one per line.
mailpit_ids() {
  local json
  json=$(curl -fsS "$MAILPIT_URL/api/v1/messages?limit=500") || return 1
  # Each message object lists its "ID" before its "Subject".
  printf '%s\n' "$json" | { grep -o '"ID":"[^"]*"\|"Subject":"[^"]*"' || true; } |
    awk -v sub_="$1" '/^"ID"/ { id = substr($0, 7, length($0) - 7) } /^"Subject"/ && index($0, sub_) { print id }'
}

# Number of messages whose subject contains $1.
mailpit_count() {
  local ids
  ids=$(mailpit_ids "$1") || return 1
  [ -z "$ids" ] && { printf '0\n'; return 0; }
  printf '%s\n' "$ids" | wc -l
}

# The id of the one message whose subject contains $1; fails when there are
# none or several.
mailpit_message_id() {
  local ids
  ids=$(mailpit_ids "$1") || return 1
  [ -n "$ids" ] && [ "$(printf '%s\n' "$ids" | wc -l)" -eq 1 ] || {
    printf 'expected exactly one message with subject containing [%s]\n' "$1" >&2
    return 1
  }
  printf '%s\n' "$ids"
}

# The message as received, headers included.
mailpit_raw() {
  local id
  id=$(mailpit_message_id "$1") || return 1
  curl -fsS "$MAILPIT_URL/api/v1/message/$id/raw"
}

# The envelope sender (Return-Path) Mailpit recorded for the message.
mailpit_envelope_sender() {
  local id json
  id=$(mailpit_message_id "$1") || return 1
  json=$(curl -fsS "$MAILPIT_URL/api/v1/message/$id") || return 1
  printf '%s\n' "$json" | sed -n 's/.*"ReturnPath":"\([^"]*\)".*/\1/p'
}

# The file name of the message's first attachment.
mailpit_attachment_name() {
  local id json
  id=$(mailpit_message_id "$1") || return 1
  json=$(curl -fsS "$MAILPIT_URL/api/v1/message/$id") || return 1
  printf '%s\n' "$json" | sed -n 's/.*"Attachments":\[{[^]]*"FileName":"\([^"]*\)".*/\1/p'
}

# mailpit_download_attachment <subject-substring> <outfile>: saves the first
# attachment of the one matching message.
mailpit_download_attachment() {
  local id json part
  id=$(mailpit_message_id "$1") || return 1
  json=$(curl -fsS "$MAILPIT_URL/api/v1/message/$id") || return 1
  part=$(printf '%s\n' "$json" | sed -n 's/.*"Attachments":\[{"PartID":"\([^"]*\)".*/\1/p')
  [ -n "$part" ] || {
    printf 'no attachment in the message with subject containing [%s]\n' "$1" >&2
    return 1
  }
  curl -fsS -o "$2" "$MAILPIT_URL/api/v1/message/$id/part/$part"
}

run_tests() {
  local name
  for name in $(declare -F | awk '{print $3}' | grep '^test_' || true); do
    # The subshell must not sit in an if/||/&& context, where bash ignores
    # `set -e` inside it: capture its status around a temporary `set +e`.
    local status=0
    set +e
    (
      set -e
      "$name"
    )
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
      printf 'PASS: %s\n' "$name"
    else
      printf 'FAIL: %s\n' "$name"
      FAILED=1
    fi
  done
  exit "$FAILED"
}
