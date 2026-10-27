import type { NestExpressApplication } from '@nestjs/platform-express';

// An import preview or confirmation of a 5,000-row file resends every choice
// the Member made, which outgrows the 100 KB default.
export const IMPORT_JSON_BODY_LIMIT = '2mb';
const DEFAULT_JSON_BODY_LIMIT = '100kb';

// Behind the global prefix in production, bare in the test app.
const IMPORT_BODY_PATH = /^(?:\/api)?\/operations\/import\/[^/?]+\/(?:preview|confirm)\/?(?:\?|$)/;

export function isImportBodyUrl(url: string | undefined): boolean {
  return IMPORT_BODY_PATH.test(url ?? '');
}

const isJson = (contentType: string | undefined) => /^application\/json\b/i.test(contentType ?? '');

// Nest's own JSON parser has one limit for the whole app, so the two limits
// are two parsers that each take the requests of their side; no other route
// accepts more than the default.
export function useJsonBodyLimit(app: NestExpressApplication): void {
  app.useBodyParser('json', {
    limit: IMPORT_JSON_BODY_LIMIT,
    type: (req) => isImportBodyUrl(req.url) && isJson(req.headers['content-type']),
  });
  app.useBodyParser('json', {
    limit: DEFAULT_JSON_BODY_LIMIT,
    type: (req) => !isImportBodyUrl(req.url) && isJson(req.headers['content-type']),
  });
}
