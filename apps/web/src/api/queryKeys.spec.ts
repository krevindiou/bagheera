import { describe, expect, it, vi } from 'vitest';
import { invalidateAccountData, queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('keeps every static (top-level array) key unique', () => {
    const staticKeys = [
      queryKeys.accounts,
      queryKeys.banks,
      queryKeys.categories,
      queryKeys.paymentMethods,
      queryKeys.dashboard.all,
      queryKeys.webauthnCredentials,
      queryKeys.reports,
    ].map((key) => key.join('/'));

    expect(new Set(staticKeys).size).toBe(staticKeys.length);
    expect(queryKeys.accounts).toEqual(['accounts']);
  });

  it('makes every `.all(...)` prefix a real prefix of its own `.page`/`.range` key', () => {
    // TanStack invalidateQueries matches by prefix — if `.all` ever drifted
    // out of sync with the fuller key, invalidating "every page/range"
    // would silently stop reaching what's actually cached.
    expect(queryKeys.operations.page('a1', 2).slice(0, 2)).toEqual(queryKeys.operations.all('a1'));
    expect(queryKeys.schedulers.page('a1', 2).slice(0, 2)).toEqual(queryKeys.schedulers.all('a1'));
    expect(queryKeys.chart.range('a1', '24').slice(0, 2)).toEqual(queryKeys.chart.all('a1'));
    expect(queryKeys.dashboard.range('24').slice(0, 1)).toEqual(queryKeys.dashboard.all);
  });
});

describe('invalidateAccountData', () => {
  it("invalidates the account's operations, and chart, plus the dashboard and accounts list (which carries the balances)", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as Parameters<
      typeof invalidateAccountData
    >[0];

    await invalidateAccountData(queryClient, 'a1');

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(queryKeys.operations.all('a1'));
    expect(invalidatedKeys).toContainEqual(queryKeys.chart.all('a1'));
    expect(invalidatedKeys).toContainEqual(queryKeys.dashboard.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.accounts);
  });
});
