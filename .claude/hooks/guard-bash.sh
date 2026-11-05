#!/usr/bin/env bash
# PreToolUse(Bash) guard: turns two CLAUDE.md rules into real controls.
# deny = exit 2 + stderr (shown to the model); ask = JSON permissionDecision.

cmd=$(jq -r '.tool_input.command // ""')

# A command starts the string or follows a shell separator, optionally behind
# the rtk proxy, so `make exec-api CMD="pnpm test"` and `docker ... exec` pass.
start='(^|[;&|][[:space:]]*)(rtk[[:space:]]+)?'

local_runtime="${start}(pnpm|npx|drizzle-kit|vitest)([[:space:]]|$)"
git_write="${start}git[[:space:]]+((-C|-c)[[:space:]]+[^[:space:]]+[[:space:]]+)*(commit|push)([[:space:]]|$)"

if [[ $cmd =~ $local_runtime ]]; then
  echo 'Docker only: run it via `make exec-api CMD="..."` or `make exec-web CMD="..."` (CLAUDE.md).' >&2
  exit 2
fi

if [[ $cmd =~ $git_write ]]; then
  jq -n '{hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: "CLAUDE.md: never commit or push unless the user explicitly asks"
  }}'
fi

exit 0
