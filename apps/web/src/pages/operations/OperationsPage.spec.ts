import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { useConfirm } from '../../composables/useConfirm';
import type { Account, Bank } from '../accounts/accounts.types';
import OperationForm from './OperationForm.vue';
import OperationsPage from './OperationsPage.vue';
import { PAYMENT_METHOD_ID } from './operations.types';
import type { Category, Operation, PaymentMethod, SearchCriteria } from './operations.types';

const apiClient = asMockedApiClient(realApiClient);

const ACCOUNT_ID = '00000000-0000-7000-8000-000000000201';
const CATEGORY_FOOD = '00000000-0000-7000-8000-000000000101';

// "operations" carries meta.requiresAuth on the real route table (see the
// AccountsPage/BaseLayout specs for the same reasoning) — a dedicated stub
// avoids the real guard silently redirecting every push to sign-in.
function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
      { path: '/accounts/:accountId/schedulers', name: 'schedulers', component: stub },
    ],
  });
}

const account: Account = {
  id: ACCOUNT_ID,
  bankId: 'b1',
  name: 'Checking',
  currency: 'USD',
  closed: false,
  deleted: false,
};
const bank: Bank = { id: 'b1', name: 'Chase', closed: false, deleted: false };
const category: Category = { id: CATEGORY_FOOD, parentId: null, type: 'debit', name: 'Food' };
const paymentMethod: PaymentMethod = {
  id: PAYMENT_METHOD_ID.CHECK_DEBIT,
  name: 'Check',
  type: 'debit',
};

function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 'o1',
    accountId: ACCOUNT_ID,
    schedulerId: null,
    transferOperationId: null,
    transferAccountId: null,
    categoryId: CATEGORY_FOOD,
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    thirdParty: 'Landlord',
    debit: 500000,
    credit: null,
    valueDate: '2026-01-15',
    reconciled: false,
    notes: '',
    ...overrides,
  };
}

interface OperationList {
  items: Operation[];
  total: number;
  page: number;
  pageSize: number;
  active?: boolean;
  criteria?: SearchCriteria;
}

interface MockState {
  accounts?: Account[];
  banks?: Bank[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  balance?: { balance: number; reconciledBalance: number } | null;
  chart?: {
    currency: string;
    axisBounds: { min: number; max: number } | null;
    points: { period: string; value: number }[];
  } | null;
  operations?: OperationList;
}

function mockGet(state: MockState = {}) {
  const {
    accounts = [account],
    banks = [bank],
    categories = [category],
    paymentMethods = [paymentMethod],
    balance = { balance: 1000, reconciledBalance: 900 },
    chart = null,
    operations = { items: [], total: 0, page: 1, pageSize: 20 },
  } = state;
  apiClient.GET.mockImplementation(async (path: string) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
    if (path === '/accounts') return ok(accounts);
    if (path === '/banks') return ok(banks);
    if (path === '/reference-data/categories') return ok(categories);
    if (path === '/reference-data/payment-methods') return ok(paymentMethods);
    if (path === '/accounts/{id}/balance') return ok(balance);
    if (path === '/accounts/{id}/chart') return ok(chart);
    if (path === '/operations/search') return ok(operations);
    return ok(undefined);
  });
}

let router: Router;
let wrapper: VueWrapper | undefined;

describe('OperationsPage', () => {
  beforeEach(async () => {
    router = createTestRouter();
    await router.push({ name: 'operations', params: { accountId: ACCOUNT_ID } });
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.DELETE.mockReset();
    mockGet();
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('shows the account and bank name in the header', async () => {
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('h1').text()).toContain('Chase');
    expect(wrapper.find('h1').text()).toContain('Checking');
  });

  it("falls back to a generic title when the account isn't found yet", async () => {
    mockGet({ accounts: [] });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('h1').text()).toBe('Operations');
  });

  it('shows the balance and reconciled balance, colored by sign', async () => {
    mockGet({ balance: { balance: -500, reconciledBalance: 100 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    const balances = wrapper.find('[data-testid="account-balances"]');
    expect(balances.text()).toContain('-$500.00');
    expect(balances.text()).toContain('$100.00');
    expect(balances.find('.text-danger').exists()).toBe(true);
  });

  it('shows the onboarding tip only for a fully active account with no operations and no active search', async () => {
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(true);
  });

  it('hides New operation and the onboarding tip for a closed account', async () => {
    mockGet({ accounts: [{ ...account, closed: true }] });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(false);
    expect(wrapper.find('button.btn-primary').exists()).toBe(false);
  });

  it('lists operations with reconciled/scheduler icons and signed, formatted amounts', async () => {
    mockGet({
      operations: {
        items: [
          operation({ id: 'o1', reconciled: true, debit: 500000 }),
          operation({ id: 'o2', schedulerId: 's1', debit: null, credit: 250000 }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('[data-testid="reconciled-icon"]').exists()).toBe(true);
    expect(rows[0].text()).toContain('-$50.00');
    expect(rows[1].find('[data-testid="scheduler-icon"]').exists()).toBe(true);
    expect(rows[1].text()).toContain('+$25.00');
  });

  it('opens the edit form when a row is clicked, but not for the initial-balance row', async () => {
    mockGet({
      operations: {
        items: [
          operation({ id: 'o1' }),
          operation({ id: 'o2', paymentMethodId: PAYMENT_METHOD_ID.INITIAL_BALANCE }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows[1].find('button').exists()).toBe(false);

    await rows[0].trigger('click');
    expect(wrapper.find('#operation-third-party').exists()).toBe(true);
  });

  it('paginates: Previous/Next are bounded, and Next re-queries the next page', async () => {
    mockGet({ operations: { items: [operation()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.text()).toContain('Page 1 of 3');
    const [prev, next] = wrapper.findAll('nav button');
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();

    await next.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID, page: '2' } },
    });

    await prev.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID, page: '1' } },
    });
  });

  it('toggles the search panel and runs a search through the mutation', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: { items: [operation()], total: 1, page: 1, pageSize: 20 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="toggle-search"]').trigger('click');
    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(true);

    await wrapper.find('[data-testid="search-form"]').trigger('submit');
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/operations/search', {
      params: { query: { page: '1' } },
      body: expect.objectContaining({ accountId: ACCOUNT_ID }),
    });
  });

  it('clears the search via the DELETE endpoint', async () => {
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    await wrapper.find('[data-testid="toggle-search"]').trigger('click');

    await wrapper.find('[data-testid="search-form"] button.btn-outline-secondary').trigger('click');
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID } },
    });
  });

  it('auto-opens the search panel, hydrated, when the server reports an active recalled search', async () => {
    mockGet({
      operations: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        active: true,
        criteria: { type: 'credit', thirdParty: 'Foo' },
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(true);
    expect((wrapper.find('#search-third-party').element as HTMLInputElement).value).toBe('Foo');
  });

  it('shows batch actions once rows are selected, and refreshes after a batch action completes', async () => {
    mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: { deletedCount: 1 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="operation-row"] input[type="checkbox"]').setValue(true);
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(true);

    const getCallsBefore = apiClient.GET.mock.calls.length;
    await wrapper.find('[data-testid="batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('hides batch actions again once every row is deselected', async () => {
    mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="operation-row"] input[type="checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(true);

    await checkbox.setValue(false);
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(false);
  });

  it("shows the account's chart once it has data", async () => {
    mockGet({
      chart: {
        currency: 'USD',
        axisBounds: { min: 0, max: 1000 },
        points: [{ period: '2026-01', value: 500 }],
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const chart = wrapper.findComponent(SynthesisChart);
    expect(chart.props('series')).toEqual([
      { label: 'USD', color: '#0d6efd', points: [{ period: '2026-01', value: 500 }] },
    ]);
    expect(chart.props('axisBounds')).toEqual({ min: 0, max: 1000 });
  });

  it('resets to page 1 when navigating to a different account', async () => {
    const ACCOUNT_ID_2 = '00000000-0000-7000-8000-000000000202';
    mockGet({ operations: { items: [operation()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const [, next] = wrapper.findAll('nav button');
    await next.trigger('click');
    await flushPromises();
    expect(apiClient.GET).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID, page: '2' } },
    });

    await router.push({ name: 'operations', params: { accountId: ACCOUNT_ID_2 } });
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID_2, page: '1' } },
    });
  });

  it('creates an operation from the New operation button and refreshes the list, chart, and balance', async () => {
    mockGet();
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('#operation-third-party').exists()).toBe(true);

    await wrapper.find('#operation-third-party').setValue('Landlord');
    await wrapper.find('#operation-amount').setValue('50');
    await wrapper.find('#operation-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    const getCallsBefore = apiClient.GET.mock.calls.length;
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      '/operations',
      expect.objectContaining({ body: expect.objectContaining({ thirdParty: 'Landlord' }) }),
    );
    expect(wrapper.find('#operation-third-party').exists()).toBe(false);
    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('cancels the create form without saving', async () => {
    mockGet();
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('#operation-third-party').exists()).toBe(true);

    await wrapper
      .findComponent(OperationForm)
      .find('button.btn-outline-secondary')
      .trigger('click');
    expect(wrapper.find('#operation-third-party').exists()).toBe(false);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});
