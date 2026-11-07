#!/usr/bin/env bash
# Must-block / must-allow cases for the hooks next to this file. One-sided tests drift
# toward over-blocking, so every guard has both. Run: .claude/hooks/test.sh
set -u

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
export CLAUDE_PROJECT_DIR=$root
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export TMPDIR=$tmp

fail=0
report() { # want got label
  if [[ $1 == "$2" ]]; then echo "ok   $1  $3"; else echo "FAIL want=$1 got=$2  $3"; fail=1; fi
}

bash_case() { # deny|ask|allow command
  local out rc got=allow
  out=$(jq -n --arg c "$2" '{tool_input:{command:$c}}' | "$here/guard-bash.sh" 2>/dev/null); rc=$?
  if [[ $rc -eq 2 ]]; then got=deny; elif [[ $out == *'"ask"'* ]]; then got=ask; fi
  report "$1" "$got" "$2"
}

reason_case() { # contains|lacks substring command
  local out got=lacks
  out=$(jq -n --arg c "$3" '{tool_input:{command:$c}}' | "$here/guard-bash.sh" 2>/dev/null)
  [[ $out == *"$2"* ]] && got=contains
  report "$1" "$got" "reason '$2' :: $3"
}

generated_case() { # deny|allow path
  local rc got=allow
  jq -n --arg f "$root/$2" '{tool_input:{file_path:$f}}' | "$here/guard-generated.sh" >/dev/null 2>&1; rc=$?
  [[ $rc -eq 2 ]] && got=deny
  report "$1" "$got" "$2"
}

remind_case() { # none|<substring> session path
  local out rc got
  out=$(jq -n --arg f "$root/$3" --arg s "$2" '{session_id:$s,tool_input:{file_path:$f}}' | "$here/remind-regenerate.sh"); rc=$?
  if [[ $rc -ne 0 ]]; then got="exit-$rc"
  elif [[ -z $out ]]; then got=none
  elif [[ $1 != none && $out == *"$1"* ]]; then got=$1
  else got="unexpected: $out"; fi
  report "$1" "$got" "$3 [$2]"
}

echo '# guard-bash'
bash_case deny  'pnpm test'
bash_case deny  'rtk pnpm install'
bash_case deny  'cd apps/api && pnpm db:generate --name x'
bash_case deny  'npx vitest run'
bash_case deny  'drizzle-kit generate'
bash_case deny  'echo hi; vitest'
bash_case allow 'make exec-api CMD="pnpm test:cov"'
bash_case allow 'make exec-web CMD="pnpm generate:api-client"'
bash_case allow 'docker compose exec api pnpm test'
bash_case allow 'rtk git status'
bash_case allow 'git log --grep commit'
bash_case allow 'git diff | grep push'
bash_case allow 'echo pnpm'
bash_case ask   'git commit -m x'
bash_case ask   'rtk git push origin main'
bash_case ask   'git -C /tmp/x commit -m y'
bash_case ask   'git add . && git commit -m z'
reason_case contains 'make precommit' 'git commit -m x'
reason_case contains 'make precommit' 'rtk git -C /tmp/x commit -m y'
reason_case lacks    'make precommit' 'git push origin main'

echo '# guard-generated'
generated_case deny  apps/web/src/api/schema.d.ts
generated_case deny  pnpm-lock.yaml
generated_case deny  apps/api/drizzle/meta/_journal.json
generated_case deny  apps/api/drizzle/meta/9999_snapshot.json
generated_case deny  apps/api/drizzle/0000_initial_schema.sql
generated_case deny  apps/api/drizzle/../drizzle/0000_initial_schema.sql
generated_case allow apps/api/drizzle/9999_brand_new.sql
generated_case allow apps/api/src/db/schema/member.ts
generated_case allow apps/web/src/api/client.ts
generated_case allow apps/web/src/api/schema.d.ts.md
generated_case allow package.json
generated_case allow .claude/settings.json

echo '# remind-regenerate'
remind_case db:generate            s1 apps/api/src/db/schema/member.ts
remind_case none                   s1 apps/api/src/db/schema/account.ts
remind_case db:generate            s2 apps/api/src/db/schema/account.ts
remind_case generate:api-client    s1 apps/api/src/accounts/account.controller.ts
remind_case none                   s1 apps/api/src/accounts/dto/create-account.dto.ts
remind_case @bagheera/money        s1 packages/money/src/index.ts
remind_case @bagheera/reference-data s1 packages/reference-data/src/seed.ts
remind_case none                   s3 apps/api/src/db/schema/member.integration-spec.ts
remind_case none                   s3 apps/api/src/accounts/account.controller.spec.ts
remind_case none                   s3 apps/api/src/accounts/account.service.ts
remind_case none                   s3 apps/web/src/pages/x.vue
remind_case none                   s3 packages/money/package.json

exit $fail
