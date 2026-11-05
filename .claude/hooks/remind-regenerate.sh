#!/usr/bin/env bash
# PostToolUse(Edit|Write) reminder: tell the model which regeneration step an edit
# just made necessary. Advisory only, and once per session per kind to stay quiet.

input=$(cat)
file=$(jq -r '.tool_input.file_path // ""' <<<"$input")
session=$(jq -r '.session_id // "nosession"' <<<"$input")
[[ -n $file ]] || exit 0

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}
rel=$(realpath -m --relative-to="$root" -- "$file")

# Specs and test fixtures never change a schema, a contract or a package build.
case $rel in *.spec.ts|*.integration-spec.ts|*.test.ts) exit 0 ;; esac

kind='' msg=''
case $rel in
  apps/api/src/db/schema/*.ts)
    kind=migration
    msg='DB schema changed: generate the migration with `make exec-api CMD="pnpm db:generate --name <snake_case_description>"` (always pass --name) and keep it compatible with the previous release (expand now, drop/rename later).' ;;
  apps/api/src/*.controller.ts|apps/api/src/*.dto.ts)
    kind=api-client
    msg='API contract may have changed: with the api running, regenerate the web client with `make exec-web CMD="pnpm generate:api-client"` and commit src/api/schema.d.ts.' ;;
  packages/*/src/*)
    pkg=${rel#packages/}; pkg=${pkg%%/*}
    kind=package-$pkg
    msg="packages/$pkg ships compiled dist/: rebuild it with \`make exec-api CMD=\"pnpm --filter @bagheera/$pkg build\"\` (or restart the container) before a running dev container sees the change." ;;
esac

[[ -n $kind ]] || exit 0

stamp="${TMPDIR:-/tmp}/bagheera-remind-$session-$kind"
[[ -e $stamp ]] && exit 0
: >"$stamp"

jq -n --arg m "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $m}}'
exit 0
