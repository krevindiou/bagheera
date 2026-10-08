import { describe, expect, it } from 'vitest';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { takeUrlKey } from './takeUrlKey';

function setup(query: Record<string, unknown>) {
  const replaced: unknown[] = [];
  const router = { replace: (to: unknown) => (replaced.push(to), Promise.resolve()) };
  const route = { query } as unknown as RouteLocationNormalizedLoaded;
  return { replaced, route, router: router as unknown as Router };
}

describe('takeUrlKey', () => {
  it('returns the key and replaces the URL without it, keeping other params', () => {
    const { replaced, route, router } = setup({ key: 'abc123', ref: 'mail' });

    expect(takeUrlKey(route, router)).toBe('abc123');
    expect(replaced).toEqual([{ query: { ref: 'mail' } }]);
  });

  it.each([{}, { key: '' }, { key: ['a', 'b'] }])(
    'returns null and leaves the URL alone for %j',
    (query) => {
      const { replaced, route, router } = setup(query);

      expect(takeUrlKey(route, router)).toBeNull();
      expect(replaced).toEqual([]);
    },
  );
});
