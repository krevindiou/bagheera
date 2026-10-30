import { toMinorUnits as m } from '@bagheera/money';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { queuedToastText } from '../../test-support/queuedToastText';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { colorForCurrency } from '../../components/chartColors';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from '../accounts/accounts.types';
import OperationForm from './OperationForm.vue';
import OperationsPage from './OperationsPage.vue';
import { formatDate } from '../../domain/money';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import type {
  Category,
  Operation,
  PaymentMethod,
  SearchCriteria,
} from '../../domain/referenceData';

const apiClient = asMockedApiClient(realApiClient);

const ACCOUNT_ID = '00000000-0000-7000-8000-000000000201';
const ACCOUNT_SAVINGS = '00000000-0000-7000-8000-000000000202';
const CATEGORY_FOOD = '00000000-0000-7000-8000-000000000101';

// A stub router: the real one's auth guard would redirect to sign-in.
// "accounts" is there for the back link to resolve.
function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
      { path: '/accounts/:accountId/schedulers', name: 'schedulers', component: stub },
      { path: '/accounts/:accountId/import', name: 'operations-import', component: stub },
      { path: '/accounts', name: 'accounts', component: stub },
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
  balance: m(1000),
  reconciledBalance: m(900),
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
    sourceLabel: null,
    bankReference: null,
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
    chart = null,
    operations = { items: [], total: 0, page: 1, pageSize: 20 },
  } = state;
  apiClient.GET.mockImplementation(async (path: string) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
    if (path === '/accounts') return ok(accounts);
    if (path === '/banks') return ok(banks);
    if (path === '/reference-data/categories') return ok(categories);
    if (path === '/reference-data/payment-methods') return ok(paymentMethods);
    if (path === '/accounts/{id}/chart') return ok(chart);
    if (path === '/operations') return ok(operations);
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
    useToast().toasts.splice(0);
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

  it('shows the balance as the primary figure (colored by sign) and reconciled balance as a muted footnote', async () => {
    mockGet({ accounts: [{ ...account, balance: m(-500), reconciledBalance: m(100) }] });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    const balances = wrapper.find('[data-testid="account-balances"]');
    expect(balances.text()).toContain('-$500.00');
    expect(balances.text()).toContain('$100.00');
    expect(balances.find('.stat-value-primary.text-danger').exists()).toBe(true);
    // The footnote stays muted even though the account is overdrawn — only
    // the primary balance above it gets the red treatment.
    expect(balances.find('.stat-footnote-value.text-danger').exists()).toBe(false);
  });

  it("takes the balances from the accounts list instead of requesting the account's balance", async () => {
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="account-balances"]').text()).toContain('$1,000.00');
    expect(wrapper.find('[data-testid="account-balances"]').text()).toContain('$900.00');
    expect(apiClient.GET.mock.calls.map((call) => call[0])).not.toContain('/accounts/{id}/balance');
  });

  it('refetches the accounts list on mount even when it was loaded moments ago', async () => {
    const { global, queryClient } = withGlobalPlugins(router);
    queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 0, staleTime: 30_000 } });
    queryClient.setQueryData(queryKeys.accounts, [
      { ...account, balance: m(1), reconciledBalance: m(1) },
    ]);
    wrapper = mount(OperationsPage, { global });
    await flushPromises();
    expect(apiClient.GET).toHaveBeenCalledWith('/accounts');
    expect(wrapper.find('[data-testid="account-balances"]').text()).toContain('$1,000.00');
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

  it('shows an error message instead of the empty state when the list fails to load', async () => {
    apiClient.GET.mockImplementation(async (path: string) => {
      if (path === '/operations') {
        return {
          data: undefined,
          error: { message: 'Internal error' },
          response: new Response(null, { status: 500 }),
        };
      }
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
      if (path === '/accounts') return ok([account]);
      if (path === '/banks') return ok([bank]);
      if (path === '/reference-data/categories') return ok([category]);
      if (path === '/reference-data/payment-methods') return ok([paymentMethod]);
      if (path === '/accounts/{id}/chart') return ok(null);
      return ok(undefined);
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="operations-error"]').text()).toContain(
      "Couldn't load this. Please try again.",
    );
    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(false);
  });

  it('shows a loading status instead of the empty state and onboarding tip while operations are still loading', async () => {
    let resolveOperations!: (value: unknown) => void;
    apiClient.GET.mockImplementation(async (path: string) => {
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
      if (path === '/operations') return new Promise((resolve) => (resolveOperations = resolve));
      if (path === '/accounts') return ok([account]);
      if (path === '/banks') return ok([bank]);
      if (path === '/reference-data/categories') return ok([category]);
      if (path === '/reference-data/payment-methods') return ok([paymentMethod]);
      if (path === '/accounts/{id}/chart') return ok(null);
      return ok(undefined);
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toBe('Loading…');
    expect(wrapper.text()).not.toContain('No operations yet.');
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(false);

    resolveOperations({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      error: undefined,
      response: new Response(),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('No operations yet.');
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(true);
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
    expect(rows[0].text()).toContain('Check');
    expect(rows[1].find('[data-testid="scheduler-icon"]').exists()).toBe(true);
    expect(rows[1].text()).toContain('+$25.00');
    // Only credits are tinted: a debit's minus sign already says what it is.
    expect(rows[0].get('td.amount').classes()).not.toContain('text-danger');
    expect(rows[0].get('td.amount').classes()).not.toContain('text-success');
    expect(rows[1].get('td.amount').classes()).toContain('text-success');
  });

  it('signs and tints a zero debit as a debit, not by its falsy amount', async () => {
    mockGet({
      operations: {
        items: [operation({ id: 'o1', debit: 0, credit: null })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const amount = wrapper.get('[data-testid="operation-row"] td.amount');
    expect(amount.text()).toBe('-$0.00');
    expect(amount.classes()).not.toContain('text-success');
  });

  it('folds the status icons and the date into the third-party cell below md, keeping their own columns from md up', async () => {
    mockGet({
      operations: {
        items: [operation({ id: 'o1', reconciled: true, valueDate: '2026-01-15' })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const cells = wrapper.get('[data-testid="operation-row"]').findAll('td');
    const columns = cells.filter((cell) => cell.classes('d-none'));
    const thirdParty = cells.find((cell) => cell.find('.d-md-none').exists());
    expect(thirdParty).toBeDefined();
    expect(thirdParty!.classes()).not.toContain('d-none');
    expect(thirdParty!.find('.d-md-none [data-testid="reconciled-icon"]').exists()).toBe(true);
    expect(thirdParty!.find('div.d-md-none').text()).toBe(formatDate('2026-01-15'));

    const statusColumn = columns.find((cell) =>
      cell.find('[data-testid="reconciled-icon"]').exists(),
    );
    const dateColumn = columns.find((cell) => cell.text() === formatDate('2026-01-15'));
    expect(statusColumn?.classes()).toContain('d-md-table-cell');
    expect(dateColumn?.classes()).toContain('d-md-table-cell');
  });

  it('hides the status and value date headers in step with their columns', async () => {
    mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const headers = wrapper.findAll('[data-testid="operations-table"] thead th');
    const rowCells = wrapper.get('[data-testid="operation-row"]').findAll('td');
    expect(headers).toHaveLength(rowCells.length);
    const hiddenBelowMd = (cell: { classes: (name: string) => boolean }) =>
      cell.classes('d-none') && cell.classes('d-md-table-cell');
    expect(headers.map(hiddenBelowMd)).toEqual(rowCells.map(hiddenBelowMd));
    expect(headers.find((th) => th.text() === 'Value date')).toSatisfy(hiddenBelowMd);
  });

  it('names the counterpart account for an internal transfer, with direction matching debit/credit', async () => {
    mockGet({
      accounts: [account, { ...account, id: ACCOUNT_SAVINGS, name: 'Savings' }],
      operations: {
        items: [
          operation({ id: 'o1', transferAccountId: ACCOUNT_SAVINGS, debit: 500000 }),
          operation({
            id: 'o2',
            transferAccountId: ACCOUNT_SAVINGS,
            debit: null,
            credit: 500000,
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows[0].find('[data-testid="transfer-counterpart"]').text()).toBe('→ Chase — Savings');
    expect(rows[1].find('[data-testid="transfer-counterpart"]').text()).toBe('← Chase — Savings');
  });

  it('labels the counterpart with its own bank, distinguishing it from a same-named account at the source bank', async () => {
    const otherBank: Bank = { id: 'b2', name: 'Second Bank', closed: false, deleted: false };
    mockGet({
      banks: [bank, otherBank],
      accounts: [account, { ...account, id: ACCOUNT_SAVINGS, bankId: 'b2', name: 'Checking' }],
      operations: {
        items: [operation({ id: 'o1', transferAccountId: ACCOUNT_SAVINGS, debit: 500000 })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows[0].find('[data-testid="transfer-counterpart"]').text()).toBe(
      '→ Second Bank — Checking',
    );
  });

  it('shows nothing extra for a transfer whose counterpart account is not in the loaded list', async () => {
    mockGet({
      accounts: [account],
      operations: {
        items: [operation({ id: 'o1', transferAccountId: ACCOUNT_SAVINGS, debit: 500000 })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows[0].find('[data-testid="transfer-counterpart"]').exists()).toBe(false);
  });

  it('shows nothing extra for a non-transfer operation', async () => {
    mockGet({
      operations: { items: [operation({ id: 'o1' })], total: 1, page: 1, pageSize: 20 },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect(rows[0].find('[data-testid="transfer-counterpart"]').exists()).toBe(false);
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
    // Not batch-selectable either, like it has no Edit button (the API
    // drops it from batches too).
    expect(rows[1].find('input[type="checkbox"]').exists()).toBe(false);
    expect(rows[0].find('input[type="checkbox"]').exists()).toBe(true);

    await rows[0].trigger('click');
    expect(wrapper.find('#operation-third-party').exists()).toBe(true);
  });

  it('deletes the operation being edited, closes the drawer and refreshes the list', async () => {
    mockGet({ operations: { items: [operation({ id: 'o1' })], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: { deletedCount: 1 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="operation-row"]').trigger('click');
    const getCallsBefore = apiClient.GET.mock.calls.length;

    await wrapper.findComponent(OperationForm).find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/operations/batch/delete', {
      body: { ids: ['o1'] },
    });
    expect(wrapper.find('#operation-third-party').exists()).toBe(false);
    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('paginates: Previous/Next are bounded, and Next re-queries the next page', async () => {
    mockGet({ operations: { items: [operation()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.text()).toContain('Page 1 of 3');
    const pagerButtons = wrapper.findAll('nav.pager button');
    const prev = pagerButtons[0];
    const next = pagerButtons[pagerButtons.length - 1];
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();

    await next.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: ACCOUNT_ID, page: 2 } },
    });

    await prev.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: ACCOUNT_ID, page: 1 } },
    });
  });

  it('starts from the ?page= query param', async () => {
    mockGet({ operations: { items: [operation()], total: 45, page: 3, pageSize: 20 } });
    await router.push({
      name: 'operations',
      params: { accountId: ACCOUNT_ID },
      query: { page: '3' },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: ACCOUNT_ID, page: 3 } },
    });
  });

  it.each([['0'], ['-1'], ['abc'], [undefined]])(
    'normalizes an invalid ?page=%s to page 1',
    async (raw) => {
      mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
      await router.push({
        name: 'operations',
        params: { accountId: ACCOUNT_ID },
        query: raw === undefined ? {} : { page: raw },
      });
      wrapper = mount(OperationsPage, withGlobalPlugins(router));
      await flushPromises();

      expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
        params: { query: { accountId: ACCOUNT_ID, page: 1 } },
      });
    },
  );

  it('keeps the current page in the ?page= query param via router.replace, not push', async () => {
    // Echoes the requested page back, like the real API, so the pager's
    // Previous/Next bounds (driven by the loaded page) track every click.
    apiClient.GET.mockImplementation(
      async (path: string, options?: { params?: { query?: { page?: number } } }) => {
        const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
        if (path === '/accounts') return ok([account]);
        if (path === '/banks') return ok([bank]);
        if (path === '/reference-data/categories') return ok([category]);
        if (path === '/reference-data/payment-methods') return ok([paymentMethod]);
        if (path === '/accounts/{id}/chart') return ok(null);
        if (path === '/operations') {
          return ok({
            items: [operation()],
            total: 45,
            page: options?.params?.query?.page ?? 1,
            pageSize: 20,
          });
        }
        return ok(undefined);
      },
    );
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    const replaceSpy = vi.spyOn(router, 'replace');
    const pushSpy = vi.spyOn(router, 'push');

    // Re-found after each click: the brief isPending loading state while
    // fetching a never-before-seen page tears down and rebuilds the pager.
    await wrapper.findAll('nav.pager button').at(-1)!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBe('2');
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();

    await wrapper.findAll('nav.pager button').at(0)!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBeUndefined();
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

    await wrapper.find('#search-third-party').setValue('Landlord');
    await wrapper.find('[data-testid="search-form"]').trigger('submit');
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/operations/search', {
      params: { query: { page: 1 } },
      body: expect.objectContaining({ accountId: ACCOUNT_ID, thirdParty: 'Landlord' }),
    });
    // Submitting closes the panel and shows the active-search dot and
    // banner at once, and all three survive the `list` refetch the
    // mutation's own cache write triggers.
    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="search-active-dot"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="search-active-banner"]').text()).toContain(
      'Showing filtered operations',
    );

    // Reopening shows the criteria the search was submitted with, not a
    // blank form.
    await wrapper.find('[data-testid="toggle-search"]').trigger('click');
    expect((wrapper.find('#search-third-party').element as HTMLInputElement).value).toBe(
      'Landlord',
    );
  });

  it('toasts an error when the search mutation fails, without closing the panel', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Internal error' },
      response: new Response(null, { status: 500 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="toggle-search"]').trigger('click');
    await wrapper.find('#search-third-party').setValue('Landlord');
    await wrapper.find('[data-testid="search-form"]').trigger('submit');
    await flushPromises();

    expect(queuedToastText()).toContain("Couldn't load this. Please try again.");
    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(true);
  });

  it('shows the active-search banner only once a search is active, not just from opening the panel', async () => {
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="search-active-banner"]').exists()).toBe(false);

    await wrapper.find('[data-testid="toggle-search"]').trigger('click');
    expect(wrapper.find('[data-testid="search-active-banner"]').exists()).toBe(false);
  });

  it("clears the search via the banner's Clear search button", async () => {
    mockGet({
      operations: {
        items: [operation()],
        total: 1,
        page: 1,
        pageSize: 20,
        active: true,
        criteria: { thirdParty: 'Landlord' },
      },
    });
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="search-active-clear"]').trigger('click');
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/operations/search', {
      params: { query: { accountId: ACCOUNT_ID } },
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

  it('restores a recalled search hydrated but closed, leaving the list visible with the active banner', async () => {
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

    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="search-active-banner"]').exists()).toBe(true);

    await wrapper.find('[data-testid="toggle-search"]').trigger('click');
    expect((wrapper.find('#search-third-party').element as HTMLInputElement).value).toBe('Foo');
  });

  it('says no operations match, not that none exist, when an active search returns nothing', async () => {
    mockGet({
      operations: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        active: true,
        criteria: { thirdParty: 'Nobody' },
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('[data-testid="search-active-banner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No operations match this search.');
    expect(wrapper.text()).not.toContain('No operations yet.');
    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(false);
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

  it('invalidates every cached page, the chart, plus the dashboard and accounts list, after a batch action', async () => {
    mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: { deletedCount: 1 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const { global, queryClient } = withGlobalPlugins(router);
    wrapper = mount(OperationsPage, { global });
    await flushPromises();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await wrapper.find('[data-testid="operation-row"] input[type="checkbox"]').setValue(true);
    await wrapper.find('[data-testid="batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey?: unknown } | undefined)?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.operations.all(ACCOUNT_ID));
    // The chart shows the same deleted operations, so it needs invalidating too.
    expect(invalidatedKeys).toContainEqual(queryKeys.chart.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.dashboard.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.accounts);
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

  it('names the row checkbox after its third party and date', async () => {
    mockGet({ operations: { items: [operation()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="operation-row"] input[type="checkbox"]');
    expect(checkbox.attributes('aria-label')).toBe(`Select Landlord – ${formatDate('2026-01-15')}`);
  });

  it('selects every selectable row via the header checkbox, skipping the initial-balance row', async () => {
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

    const headerCheckbox = wrapper.find('thead input[type="checkbox"]');
    expect(headerCheckbox.attributes('aria-label')).toBe('Select all on this page');

    await headerCheckbox.setValue(true);

    const rows = wrapper.findAll('[data-testid="operation-row"]');
    expect((rows[0].find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
    // The initial-balance row has no checkbox at all, so it can't be caught up either.
    expect(rows[1].find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(true);
  });

  it('checks the header checkbox once every row is selected, marks it indeterminate when only some are, and clears all on uncheck', async () => {
    mockGet({
      operations: {
        items: [operation({ id: 'o1' }), operation({ id: 'o2' })],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const headerCheckbox = () => wrapper!.find('thead input[type="checkbox"]');
    const rowCheckboxes = () =>
      wrapper!.findAll('[data-testid="operation-row"] input[type="checkbox"]');

    await rowCheckboxes()[0].setValue(true);
    expect((headerCheckbox().element as HTMLInputElement).indeterminate).toBe(true);
    expect((headerCheckbox().element as HTMLInputElement).checked).toBe(false);

    await rowCheckboxes()[1].setValue(true);
    expect((headerCheckbox().element as HTMLInputElement).indeterminate).toBe(false);
    expect((headerCheckbox().element as HTMLInputElement).checked).toBe(true);

    await headerCheckbox().setValue(false);
    expect(rowCheckboxes().every((c) => !(c.element as HTMLInputElement).checked)).toBe(true);
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(false);
  });

  it('disables the header checkbox when no row on the page is selectable', async () => {
    mockGet({
      operations: {
        items: [operation({ id: 'o1', paymentMethodId: PAYMENT_METHOD_ID.INITIAL_BALANCE })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('thead input[type="checkbox"]').attributes('disabled')).toBeDefined();
  });

  it('hides the header checkbox for a closed account, like the row checkboxes', async () => {
    mockGet({
      accounts: [{ ...account, closed: true }],
      operations: { items: [operation()], total: 1, page: 1, pageSize: 20 },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('thead input[type="checkbox"]').exists()).toBe(false);
  });

  it("shows the account's chart once it has data, colored by the account's currency", async () => {
    mockGet({
      chart: {
        currency: 'USD',
        axisBounds: { min: 0, max: m(1000) },
        points: [{ period: '2026-01', value: m(500) }],
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const chart = wrapper.findComponent(SynthesisChart);
    // The app-wide per-currency color.
    expect(chart.props('series')).toEqual([
      { label: 'USD', color: colorForCurrency('USD'), points: [{ period: '2026-01', value: 500 }] },
    ]);
    expect(chart.props('axisBounds')).toEqual({ min: 0, max: 1000 });
    // Named for assistive tech with the account it belongs to.
    expect(chart.props('label')).toBe('Balance, Checking');
  });

  it("colors a EUR account's chart differently than a USD one", async () => {
    mockGet({
      chart: {
        currency: 'EUR',
        axisBounds: { min: 0, max: m(1000) },
        points: [{ period: '2026-01', value: m(500) }],
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const chart = wrapper.findComponent(SynthesisChart);
    expect(chart.props('series')[0].color).toBe(colorForCurrency('EUR'));
    expect(chart.props('series')[0].color).not.toBe(colorForCurrency('USD'));
  });

  it('hides the chart panel (and its range selector) when the account has no chart data', async () => {
    mockGet({ chart: null });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.find('[data-testid="account-chart-range"]').exists()).toBe(false);
  });

  it('defaults the chart range to 12 months and refetches with the chosen range on change', async () => {
    mockGet({
      chart: {
        currency: 'USD',
        axisBounds: { min: 0, max: m(1000) },
        points: [{ period: '2026-01', value: m(500) }],
      },
    });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const select = wrapper.find('[data-testid="account-chart-range"]');
    expect((select.element as HTMLSelectElement).value).toBe('12');

    apiClient.GET.mockClear();
    await select.setValue('all');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith(
      '/accounts/{id}/chart',
      expect.objectContaining({
        params: { path: { id: ACCOUNT_ID }, query: { range: 'all' } },
      }),
    );
  });

  it('resets to page 1 when navigating to a different account', async () => {
    const ACCOUNT_ID_2 = '00000000-0000-7000-8000-000000000202';
    mockGet({ operations: { items: [operation()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(OperationsPage, withGlobalPlugins(router));
    await flushPromises();

    const next = wrapper.findAll('nav.pager button').at(-1)!;
    await next.trigger('click');
    await flushPromises();
    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: ACCOUNT_ID, page: 2 } },
    });

    await router.push({ name: 'operations', params: { accountId: ACCOUNT_ID_2 } });
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/operations', {
      params: { query: { accountId: ACCOUNT_ID_2, page: 1 } },
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

  it('invalidates every cached page (not just the current one), plus the dashboard and accounts list, after saving', async () => {
    mockGet();
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const { global, queryClient } = withGlobalPlugins(router);
    wrapper = mount(OperationsPage, { global });
    await flushPromises();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.find('#operation-third-party').setValue('Landlord');
    await wrapper.find('#operation-amount').setValue('50');
    await wrapper.find('#operation-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey?: unknown } | undefined)?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.operations.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.dashboard.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.accounts);
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
