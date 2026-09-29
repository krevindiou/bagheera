import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// apps/api/src -> apps/api -> apps -> repo root.
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const API_ROOT = path.join(__dirname, '..');

// The api dev container never bind-mounts apps/web (see docker/compose.yml)
// — only a bare, full-monorepo checkout has it, which is what CI's
// api-integration job runs on. Skipped rather than failing `make
// test-integration` in the container, where it can never pass.
const hasWebWorkspace = existsSync(path.join(REPO_ROOT, 'apps', 'web'));

// A fixed, unlikely-to-collide port for the throwaway server this test
// boots below — nothing else in the integration run binds a real HTTP
// port, so a static value is fine.
const DOC_SERVER_PORT = 34579;

async function waitUntilReady(url: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Not listening yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url} to respond`);
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
}

describe.skipIf(!hasWebWorkspace)('generated web API client', () => {
  // Building the real Nest output and booting it as a subprocess is
  // slower than every other integration spec.
  it("matches the API's OpenAPI document", async () => {
    // Reproducing the exact OpenAPI document main.ts serves requires
    // going through a real `nest build` — its response schemas rely
    // entirely on the `@nestjs/swagger` Nest CLI plugin (nest-cli.json's
    // compilerOptions.plugins), which rewrites DTO classes at the
    // TypeScript-compiler level to inject the property metadata Swagger
    // reads (see e.g. dist/health/dto/health-response.dto.js's injected
    // static _OPENAPI_METADATA_FACTORY()). That's a tsc-only transform:
    // vitest's swc-based transpilation (vitest.integration.config.mts)
    // never runs it, so building the document in-process here — as this
    // spec used to — silently drops every response DTO's properties
    // (most of them have no explicit @ApiProperty(), by design, relying
    // on the plugin) and makes this check permanently fail regardless of
    // whether the committed schema.d.ts is actually stale.
    const build = spawnSync('pnpm', ['--filter', 'api', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      throw new Error(`nest build failed:\n\n${build.stdout}${build.stderr}`);
    }

    const child = spawn('node', ['dist/main.js'], {
      cwd: API_ROOT,
      env: { ...process.env, PORT: String(DOC_SERVER_PORT), NODE_ENV: 'development' },
      stdio: 'pipe',
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const dir = mkdtempSync(path.join(tmpdir(), 'bagheera-openapi-'));
    const schemaPath = path.join(dir, 'openapi.json');

    try {
      await waitUntilReady(`http://127.0.0.1:${DOC_SERVER_PORT}/health`, Date.now() + 20000);
      const res = await fetch(`http://127.0.0.1:${DOC_SERVER_PORT}/api/docs-json`);
      if (!res.ok) {
        throw new Error(`GET /api/docs-json returned ${res.status}\n\n${stderr}`);
      }
      writeFileSync(schemaPath, await res.text());
    } finally {
      await stopChild(child);
    }

    try {
      // --check compares the freshly-generated types against the committed
      // apps/web/src/api/schema.d.ts without overwriting it — exits 1 on
      // any mismatch, 0 once they agree.
      const result = spawnSync(
        'pnpm',
        [
          '--filter',
          'web',
          'exec',
          'openapi-typescript',
          schemaPath,
          '-o',
          'src/api/schema.d.ts',
          '--check',
        ],
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );

      if (result.status !== 0) {
        throw new Error(
          'apps/web/src/api/schema.d.ts is out of date with the API. Regenerate it with ' +
            '`pnpm --filter web generate:api-client` (with the API running) and commit the ' +
            `result.\n\n${result.stdout}${result.stderr}`,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
