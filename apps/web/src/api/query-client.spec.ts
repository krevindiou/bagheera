import { describe, expect, it } from 'vitest';
import { DEFAULT_STALE_TIME_MS, queryClient } from './query-client';

describe('queryClient', () => {
  it('keeps fetched data fresh for the default stale time', () => {
    expect(DEFAULT_STALE_TIME_MS).toBeGreaterThan(0);
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
  });
});
