import { defineComponent, h, type ComputedRef } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import {
  REFERENCE_QUERY_KEYS,
  useAccountsQuery,
  useBanksQuery,
  useCategoriesQuery,
  usePaymentMethodsQuery,
} from './useReferenceQueries';

const apiClient = asMockedApiClient(realApiClient);

// Runs a composable inside a mounted component, since useQuery needs the
// app's QueryClient.
function run<T>(composable: () => T): T {
  let result!: T;
  mount(
    defineComponent({
      setup() {
        result = composable();
        return () => h('div');
      },
    }),
    withGlobalPlugins(),
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
    apiClient.GET.mockResolvedValueOnce(ok(undefined));

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

  it('keeps each list under its own query key', () => {
    const keys = Object.values(REFERENCE_QUERY_KEYS).map((key) => key.join('/'));

    expect(new Set(keys).size).toBe(keys.length);
    expect(REFERENCE_QUERY_KEYS.accounts).toEqual(['accounts']);
  });
});
