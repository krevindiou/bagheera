import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage } from 'node:http';
import { isImportBodyUrl, useJsonBodyLimit } from './json-body-limit';

describe('isImportBodyUrl', () => {
  it.each([
    '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/preview',
    '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/confirm',
    '/operations/import/0190a1b2-0000-7000-8000-000000000000/preview',
    '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/preview?x=1',
  ])('gives %s the larger limit', (url) => {
    expect(isImportBodyUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    '/api/operations/import',
    '/api/operations/import/0190a1b2-0000-7000-8000-000000000000',
    '/api/operations/import/a/b/preview',
    '/api/operations/import/x/preview/extra',
    '/api/operations',
    '/api/banks',
    '/api/other/operations/import/x/preview',
  ])('keeps %s to the default limit', (url) => {
    expect(isImportBodyUrl(url)).toBe(false);
  });
});

describe('useJsonBodyLimit', () => {
  type Options = { limit: string; inflate: boolean; type: (req: IncomingMessage) => boolean };

  const parser = () => {
    const useBodyParser = vi.fn();
    useJsonBodyLimit({ useBodyParser } as unknown as NestExpressApplication);
    expect(useBodyParser).toHaveBeenCalledTimes(1);
    return useBodyParser.mock.calls[0][1] as Options;
  };
  const request = (url: string | undefined, contentType?: string) =>
    ({ url, headers: { 'content-type': contentType } }) as unknown as IncomingMessage;

  const importUrl = '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/preview';

  it('gives every route except the import bodies 100kb, uncompressed', () => {
    const { limit, inflate } = parser();

    expect([limit, inflate]).toEqual(['100kb', false]);
  });

  it('leaves JSON import bodies to the signed-in parser', () => {
    const { type } = parser();

    expect(type(request(importUrl, 'application/json'))).toBe(false);
  });

  it('parses a JSON body of any other route', () => {
    const { type } = parser();

    expect(type(request('/api/operations', 'application/json'))).toBe(true);
  });

  it.each([undefined, 'multipart/form-data; boundary=x', 'text/plain'])(
    'leaves a body of content type %s alone',
    (contentType) => {
      const { type } = parser();

      expect(type(request('/api/operations', contentType))).toBe(false);
    },
  );
});
