#!/usr/bin/env node
// CI gate: the API has no shared path prefix, so docker/Caddyfile and
// apps/web/vite.config.ts each list its controllers' first path segments by
// hand. A route missing from Caddy works in dev but returns the SPA's HTML in
// production; this fails when either list drifts from the controllers.
//
// Usage: node scripts/check-api-routes.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Caddy-only: Swagger UI, mounted outside production.
const CADDY_ONLY = new Set(['/api']);

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

export function controllerPrefixes(sources) {
  const prefixes = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/@Controller\(\s*['"]([^'"/]+)/g)) {
      prefixes.add(`/${match[1]}`);
    }
  }
  return prefixes;
}

export function caddyPrefixes(caddyfile) {
  const line = caddyfile.split('\n').find((l) => l.trim().startsWith('@api path'));
  if (!line) {
    throw new Error('No "@api path" matcher found in docker/Caddyfile');
  }
  return new Set(
    line
      .trim()
      .split(/\s+/)
      .slice(2)
      .map((p) => p.replace(/\*$/, '')),
  );
}

export function vitePrefixes(viteConfig) {
  const block = viteConfig.match(/apiRoutePrefixes\s*=\s*\[([\s\S]*?)\]/);
  if (!block) {
    throw new Error('No apiRoutePrefixes list found in apps/web/vite.config.ts');
  }
  return new Set([...block[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]));
}

export function diff(expected, actual, ignore = new Set()) {
  return {
    missing: [...expected].filter((p) => !actual.has(p)).sort(),
    extra: [...actual].filter((p) => !expected.has(p) && !ignore.has(p)).sort(),
  };
}

function main() {
  const controllers = walk(path.join(ROOT, 'apps', 'api', 'src'))
    .filter((f) => f.endsWith('.controller.ts'))
    .map((f) => readFileSync(f, 'utf8'));
  const expected = controllerPrefixes(controllers);

  const targets = [
    ['docker/Caddyfile', caddyPrefixes(readFileSync(path.join(ROOT, 'docker/Caddyfile'), 'utf8')), CADDY_ONLY],
    ['apps/web/vite.config.ts', vitePrefixes(readFileSync(path.join(ROOT, 'apps/web/vite.config.ts'), 'utf8')), new Set()],
  ];

  let failed = false;
  for (const [name, actual, ignore] of targets) {
    const { missing, extra } = diff(expected, actual, ignore);
    for (const p of missing) {
      console.error(`${name}: missing ${p} (used by an API controller)`);
      failed = true;
    }
    for (const p of extra) {
      console.error(`${name}: ${p} matches no API controller`);
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log(`API route prefixes in sync (${expected.size} controller prefixes).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
