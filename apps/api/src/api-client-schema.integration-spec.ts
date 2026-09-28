import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from './test-support/create-test-app';

// apps/api/src -> apps/api -> apps -> repo root.
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// The api dev container never bind-mounts apps/web (see docker/compose.yml)
// — only a bare, full-monorepo checkout has it, which is what CI's
// api-integration job runs on. Skipped rather than failing `make
// test-integration` in the container, where it can never pass.
const hasWebWorkspace = existsSync(path.join(REPO_ROOT, 'apps', 'web'));

describe.skipIf(!hasWebWorkspace)('generated web API client', () => {
  it("matches the API's OpenAPI document", async () => {
    const { app } = await createTestApp();
    // Same DocumentBuilder config main.ts uses to serve /api/docs-json.
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Bagheera API').setVersion('1').build(),
    );
    await app.close();

    const dir = mkdtempSync(path.join(tmpdir(), 'bagheera-openapi-'));
    const schemaPath = path.join(dir, 'openapi.json');
    writeFileSync(schemaPath, JSON.stringify(document));

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
  });
});
