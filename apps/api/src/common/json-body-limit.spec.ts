import { isImportBodyUrl } from './json-body-limit';

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
