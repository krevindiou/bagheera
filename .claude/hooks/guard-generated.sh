#!/usr/bin/env bash
# PreToolUse(Edit|Write) guard: generated files come from their tool, not from hand edits.
# deny = exit 2 + stderr (shown to the model).

input=$(cat)
file=$(jq -r '.tool_input.file_path // ""' <<<"$input")
[[ -n $file ]] || exit 0

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}
rel=$(realpath -m --relative-to="$root" -- "$file")

deny() { echo "$1" >&2; exit 2; }

case $rel in
  apps/web/src/api/schema.d.ts)
    deny 'Generated: run `make exec-web CMD="pnpm generate:api-client"` after changing the API contract.' ;;
  pnpm-lock.yaml)
    deny 'Generated: change dependencies through pnpm inside the container, never edit the lockfile by hand.' ;;
  apps/api/drizzle/meta/*)
    deny 'Generated: drizzle-kit owns the journal and snapshots; run `make exec-api CMD="pnpm db:generate --name <snake_case>"`.' ;;
  apps/api/drizzle/*.sql)
    # A committed migration is applied history; a freshly generated one may need custom SQL.
    if git -C "$root" cat-file -e "HEAD:$rel" 2>/dev/null; then
      deny 'Committed migrations are immutable: add a new one with `make exec-api CMD="pnpm db:generate --name <snake_case>"` (expand now, drop/rename later).'
    fi ;;
esac

exit 0
