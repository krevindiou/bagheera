#!/usr/bin/env node
// Axis-1 "surface completeness" CI gate for the api integration suite: every
// apps/api/src/**/*.controller.ts must have a same-directory,
// same-basename *.integration-spec.ts, or an explicit, reviewable opt-out
// comment inside the controller file itself.
//
// The opt-out lives in the controller (not a separate allowlist file) so a
// new exception shows up in the diff/review of the change that creates it,
// instead of rotting silently in a list nobody re-reads. Format, anywhere
// in the file:
//   // integration-spec: <reason>
//
// Zero dependencies (only node:fs/node:path) — deliberately runnable with
// plain `node`, matching how the rest of the "lint" CI job already runs
// (pnpm lint/format/tsc directly on the runner, no Docker). Not wired into
// the Makefile: this checks source-tree shape, not app behavior, so it
// doesn't need the dev stack running.
//
// Usage: node scripts/check-integration-spec-coverage.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'api',
  'src',
);
const OPT_OUT_PATTERN = /\/\/\s*integration-spec:\s*(.+)/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const controllers = files.filter((f) => f.endsWith('.controller.ts')).sort();
const specs = new Set(files.filter((f) => f.endsWith('.integration-spec.ts')));

let missing = 0;
for (const controller of controllers) {
  const expected = controller.replace(
    /\.controller\.ts$/,
    '.integration-spec.ts',
  );
  const relative = path.relative(SRC, controller);

  if (specs.has(expected)) {
    continue;
  }

  const optOut = readFileSync(controller, 'utf8').match(OPT_OUT_PATTERN);
  if (optOut) {
    console.log(`OK (opt-out): ${relative} — ${optOut[1].trim()}`);
    continue;
  }

  console.error(`MISSING integration spec: ${relative}`);
  missing++;
}

if (missing > 0) {
  console.error(
    `\n${missing} controller(s) with no integration spec and no opt-out comment.`,
  );
  process.exit(1);
}
console.log(`All ${controllers.length} controllers have integration coverage.`);
