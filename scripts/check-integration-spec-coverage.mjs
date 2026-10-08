#!/usr/bin/env node
// CI gate: every apps/api/src/**/*.controller.ts needs a same-basename
// *.integration-spec.ts beside it, or an opt-out comment in the controller
// itself (so an exception shows up in review), anywhere in the file:
//   // integration-spec: <reason>
//
// Dependency-free, run with plain `node` in CI's lint job.
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
