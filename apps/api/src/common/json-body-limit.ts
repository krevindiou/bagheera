import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage } from 'node:http';

// An import preview or confirmation of a 5,000-row file resends every choice
// the Member made, which outgrows the 100 KB default.
export const IMPORT_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const DEFAULT_JSON_BODY_LIMIT = '100kb';

// Behind the global prefix in production, bare in the test app.
const IMPORT_BODY_PATH = /^(?:\/api)?\/operations\/import\/[^/?]+\/(?:preview|confirm)\/?(?:\?|$)/;

export function isImportBodyUrl(url: string | undefined): boolean {
  return IMPORT_BODY_PATH.test(url ?? '');
}

export const isJson = (contentType: string | undefined) =>
  /^application\/json\b/i.test(contentType ?? '');

// Runs ahead of session and CSRF, so every route but the import bodies stays
// at the default size. `inflate: false` rejects compressed bodies (415): no
// client compresses its request body, and inflating would let a tiny request
// cost the server the full inflated size before any auth or rate check.
// Import bodies are left for session/signed-in-import-body.ts, which parses
// them only for a signed-in Member.
export function useJsonBodyLimit(app: NestExpressApplication): void {
  app.useBodyParser('json', {
    limit: DEFAULT_JSON_BODY_LIMIT,
    inflate: false,
    type: (req: IncomingMessage) =>
      !isImportBodyUrl(req.url) && isJson(req.headers['content-type']),
  });
}
