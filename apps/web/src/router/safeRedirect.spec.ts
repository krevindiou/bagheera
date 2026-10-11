import { describe, expect, it, vi } from 'vitest';
import { mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { router } from './index';
import { safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
  it.each([
    '/en/accounts/0b6f2d1e-1111-4222-8333-444455556666/schedulers',
    '/fr/reports',
    '/en/home',
  ])('accepts the in-app path %s', (path) => {
    expect(safeRedirect(router, path)).toBe(path);
  });

  it('keeps the query string and hash', () => {
    expect(safeRedirect(router, '/en/reports?type=sum#top')).toBe('/en/reports?type=sum#top');
  });

  it.each([
    ['a non-string', 42],
    ['a missing value', undefined],
    ['a repeated query value', ['/en/home', '/en/reports']],
    ['an empty string', ''],
    ['a relative path', 'en/home'],
    ['an absolute URL', 'https://evil.example/en/home'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a protocol-relative URL', '//evil.example/en/home'],
    ['a backslash-relative URL', '/\\evil.example/en/home'],
    ['a tab hiding a second slash', '/\t/evil.example'],
    ['a newline hiding a second slash', '/\n/evil.example'],
    ['an unknown path (catch-all)', '/en/no/such/page'],
    ['an unsupported locale (catch-all)', '/de/home'],
    ['the root redirect', '/'],
    ['sign-in itself', '/en/sign-in'],
    ['register', '/fr/register?redirect=/en/home'],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirect(router, value)).toBeNull();
  });
});
