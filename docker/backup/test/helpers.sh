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
