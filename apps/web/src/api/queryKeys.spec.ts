import { queryKeys } from './queryKeys';

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
