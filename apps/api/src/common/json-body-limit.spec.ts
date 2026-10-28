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
  type Options = { limit: string; type: (req: IncomingMessage) => boolean };

  const parsers = () => {
    const useBodyParser = vi.fn();
    useJsonBodyLimit({ useBodyParser } as unknown as NestExpressApplication);
    const [larger, standard] = useBodyParser.mock.calls.map(
      ([, options]: [string, Options]) => options,
    );
    return { larger, standard };
  };
  const request = (url: string | undefined, contentType?: string) =>
    ({ url, headers: { 'content-type': contentType } }) as unknown as IncomingMessage;

  const importUrl = '/api/operations/import/0190a1b2-0000-7000-8000-000000000000/preview';

  it('gives the import bodies 2mb and every other body 100kb', () => {
    const { larger, standard } = parsers();

    expect([larger.limit, standard.limit]).toEqual(['2mb', '100kb']);
  });

  it('hands a JSON import body to the larger parser only', () => {
    const { larger, standard } = parsers();
    const req = request(importUrl, 'application/json; charset=utf-8');

    expect([larger.type(req), standard.type(req)]).toEqual([true, false]);
  });

  it('hands a JSON body of any other route to the default parser only', () => {
    const { larger, standard } = parsers();
    const req = request('/api/operations', 'application/json');

    expect([larger.type(req), standard.type(req)]).toEqual([false, true]);
  });

  it.each([undefined, 'multipart/form-data; boundary=x', 'text/plain'])(
    'leaves a body of content type %s to both parsers alone',
    (contentType) => {
      const { larger, standard } = parsers();
      const req = request(importUrl, contentType);

      expect([larger.type(req), standard.type(req)]).toEqual([false, false]);
    },
  );
});
