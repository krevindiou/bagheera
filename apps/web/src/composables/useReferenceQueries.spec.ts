import { defineComponent, h, type ComputedRef } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import {
  useAccountsQuery,
  useBanksQuery,
  useCategoriesQuery,
  usePaymentMethodsQuery,
} from './useReferenceQueries';

const apiClient = asMockedApiClient(realApiClient);

// Runs a composable inside a mounted component, since useQuery needs the
// app's QueryClient.
function run<T>(composable: () => T, global = withGlobalPlugins().global): T {
  let result!: T;
  mount(
    defineComponent({
      setup() {
        result = composable();
        return () => h('div');
      },
    }),
    { global },
  );
  return result;
}

const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });

describe('useReferenceQueries', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
  });

  it.each([
    ['accounts', '/accounts', () => useAccountsQuery().accounts],
    ['banks', '/banks', () => useBanksQuery().banks],
    ['categories', '/reference-data/categories', () => useCategoriesQuery().categories],
    [
      'payment methods',
      '/reference-data/payment-methods',
      () => usePaymentMethodsQuery().paymentMethods,
    ],
  ])('loads the %s list from %s', async (_name, path, pick: () => ComputedRef<unknown[]>) => {
    const rows = [{ id: 'r1' }, { id: 'r2' }];
    apiClient.GET.mockResolvedValueOnce(ok(rows));

    const list = run(pick);
    expect(list.value).toEqual([]);
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith(path);
    expect(list.value).toEqual(rows);
  });

  it('treats a failed response as an empty list', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Internal error' },
      response: new Response(null, { status: 500 }),
    });

    const { banks } = run(useBanksQuery);
    await flushPromises();

    expect(banks.value).toEqual([]);
  });

  it('exposes the raw query, whose data is undefined until the list arrives', async () => {
    apiClient.GET.mockResolvedValueOnce(ok([{ id: 'b1' }]));

    const { banksQuery } = run(useBanksQuery);
    expect(banksQuery.data.value).toBeUndefined();
    await flushPromises();

    expect(banksQuery.data.value).toEqual([{ id: 'b1' }]);
  });

  it.each([
    ['categories', () => useCategoriesQuery().categories, 1],
    ['payment methods', () => usePaymentMethodsQuery().paymentMethods, 1],
    ['accounts', () => useAccountsQuery().accounts, 2],
    ['banks', () => useBanksQuery().banks, 2],
  ])(
    'fetches the %s list %i time(s) across two mounts (stale time 0 apart from reference data)',
    async (_name, pick: () => ComputedRef<unknown[]>, expectedCalls) => {
      apiClient.GET.mockResolvedValue(ok([{ id: 'r1' }]));
      const { global } = withGlobalPlugins();

      run(pick, global);
      await flushPromises();
      const second = run(pick, global);
      await flushPromises();

      expect(apiClient.GET).toHaveBeenCalledTimes(expectedCalls);
      expect(second.value).toEqual([{ id: 'r1' }]);
    },
  );
});
