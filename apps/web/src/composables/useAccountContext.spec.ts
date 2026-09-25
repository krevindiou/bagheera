import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import type { Account, Bank } from '../pages/accounts/accounts.types';
import { useAccountContext } from './useAccountContext';

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

// Answers GET /accounts and GET /banks with the given lists.
function serve(accounts: Account[], banks: Bank[]) {
  apiClient.GET.mockImplementation(async (path: string) =>
    ok(path === '/accounts' ? accounts : path === '/banks' ? banks : undefined),
  );
}

const bank: Bank = { id: 'b1', name: 'Chase', closed: false, deleted: false };
const account: Account = {
  id: 'a1',
  bankId: 'b1',
  name: 'Checking',
  currency: 'EUR',
  closed: false,
  deleted: false,
};

describe('useAccountContext', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
  });

  it('resolves the account, its bank and its currency', async () => {
    serve([account], [bank]);

    const context = run(() => useAccountContext(ref('a1')));
    await flushPromises();

    expect(context.account.value).toEqual(account);
    expect(context.bank.value).toEqual(bank);
    expect(context.currency.value).toBe('EUR');
    expect(context.isFullyActive.value).toBe(true);
  });

  it('has no account or bank, and falls back to USD, until the lists load', () => {
    serve([account], [bank]);

    const context = run(() => useAccountContext(ref('a1')));

    expect(context.account.value).toBeNull();
    expect(context.bank.value).toBeNull();
    expect(context.currency.value).toBe('USD');
    expect(context.isFullyActive.value).toBe(false);
  });

  it.each([
    ['the account is closed', [{ ...account, closed: true }], [bank]],
    ['its bank is closed', [account], [{ ...bank, closed: true }]],
    ['its bank is missing', [{ ...account, bankId: 'b-gone' }], [bank]],
    ['the account is unknown', [{ ...account, id: 'a-other' }], [bank]],
  ])('is not fully active when %s', async (_case, accounts, banks) => {
    serve(accounts, banks);

    const { isFullyActive } = run(() => useAccountContext(ref('a1')));
    await flushPromises();

    expect(isFullyActive.value).toBe(false);
  });

  it('follows the account id', async () => {
    const savings: Account = { ...account, id: 'a2', bankId: 'b2', currency: 'CHF' };
    const otherBank: Bank = { ...bank, id: 'b2', name: 'UBS' };
    serve([account, savings], [bank, otherBank]);
    const accountId = ref('a1');

    const context = run(() => useAccountContext(accountId));
    await flushPromises();
    accountId.value = 'a2';

    expect(context.account.value).toEqual(savings);
    expect(context.bank.value).toEqual(otherBank);
    expect(context.currency.value).toBe('CHF');
  });
});
