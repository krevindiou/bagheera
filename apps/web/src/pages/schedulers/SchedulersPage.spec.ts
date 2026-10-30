import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useConfirm } from '../../composables/useConfirm';
import { formatDate } from '../../domain/money';
import type { Account, Bank } from '../accounts/accounts.types';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import type { Category, PaymentMethod } from '../../domain/referenceData';
import SchedulerForm from './SchedulerForm.vue';
import SchedulersPage from './SchedulersPage.vue';
import type { Scheduler } from './schedulers.types';

const apiClient = asMockedApiClient(realApiClient);

const ACCOUNT_ID = '00000000-0000-7000-8000-000000000401';
const CATEGORY_FOOD = '00000000-0000-7000-8000-000000000301';

// A stub router: the real one's auth guard would redirect to sign-in.
// "operations" is there for the back link to resolve.
function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/:accountId/schedulers', name: 'schedulers', component: stub },
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
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

function scheduler(overrides: Partial<Scheduler> = {}): Scheduler {
  return {
    id: 's1',
    accountId: ACCOUNT_ID,
    transferAccountId: null,
    categoryId: CATEGORY_FOOD,
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    thirdParty: 'Landlord',
    debit: 500000,
    credit: null,
    valueDate: '2026-01-15',
    reconciled: false,
    notes: '',
    limitDate: null,
    frequencyUnit: 'month',
    frequencyValue: 1,
    active: true,
    nextOccurrence: '2026-11-15',
    ...overrides,
  };
}

interface SchedulerList {
  items: Scheduler[];
  total: number;
  page: number;
  pageSize: number;
}

interface MockState {
  accounts?: Account[];
  banks?: Bank[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  schedulers?: SchedulerList;
}

function mockGet(state: MockState = {}) {
  const {
    accounts = [account],
    banks = [bank],
    categories = [category],
    paymentMethods = [paymentMethod],
    schedulers = { items: [], total: 0, page: 1, pageSize: 20 },
  } = state;
  apiClient.GET.mockImplementation(async (path: string) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
    if (path === '/accounts') return ok(accounts);
    if (path === '/banks') return ok(banks);
    if (path === '/reference-data/categories') return ok(categories);
    if (path === '/reference-data/payment-methods') return ok(paymentMethods);
    if (path === '/schedulers') return ok(schedulers);
    return ok(undefined);
  });
}

let router: Router;
let wrapper: VueWrapper | undefined;

describe('SchedulersPage', () => {
  beforeEach(async () => {
    router = createTestRouter();
    await router.push({ name: 'schedulers', params: { accountId: ACCOUNT_ID } });
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

  it('shows the account name in the header and offers Add scheduler for a fully active account', async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('h1').text()).toContain('Checking');
    expect(wrapper.find('button.btn-primary').exists()).toBe(true);
  });

  it('hides Add scheduler for a closed account', async () => {
    mockGet({ accounts: [{ ...account, closed: true }] });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('button.btn-primary').exists()).toBe(false);
  });

  it('shows the empty state when there are no schedulers', async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.text()).toContain('No scheduled operations yet.');
  });

  it('shows an error message instead of the empty state when the list fails to load', async () => {
    apiClient.GET.mockImplementation(async (path: string) => {
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
      if (path === '/schedulers') {
        return {
          data: undefined,
          error: { message: 'Internal error' },
          response: new Response(null, { status: 500 }),
        };
      }
      if (path === '/accounts') return ok([account]);
      if (path === '/banks') return ok([bank]);
      if (path === '/reference-data/categories') return ok([category]);
      if (path === '/reference-data/payment-methods') return ok([paymentMethod]);
      return ok(undefined);
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find('[data-testid="schedulers-error"]').text()).toContain(
      "Couldn't load this. Please try again.",
    );
    expect(wrapper.text()).not.toContain('No scheduled operations yet.');
  });

  it('shows a loading status instead of the empty state while schedulers are still loading', async () => {
    let resolveSchedulers!: (value: unknown) => void;
    apiClient.GET.mockImplementation(async (path: string) => {
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
      if (path === '/schedulers') return new Promise((resolve) => (resolveSchedulers = resolve));
      if (path === '/accounts') return ok([account]);
      if (path === '/banks') return ok([bank]);
      if (path === '/reference-data/categories') return ok([category]);
      if (path === '/reference-data/payment-methods') return ok([paymentMethod]);
      return ok(undefined);
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toBe('Loading…');
    expect(wrapper.text()).not.toContain('No scheduled operations yet.');

    resolveSchedulers({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      error: undefined,
      response: new Response(),
    });
    await flushPromises();

    expect(wrapper.text()).toContain('No scheduled operations yet.');
  });

  it('lists schedulers with an active/paused dot and signed, formatted amounts', async () => {
    mockGet({
      schedulers: {
        items: [
          scheduler({ id: 's1', active: true, debit: 500000 }),
          scheduler({
            id: 's2',
            active: false,
            nextOccurrence: null,
            debit: null,
            credit: 250000,
            frequencyValue: 2,
            frequencyUnit: 'week',
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="scheduler-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.dot').classes()).toContain('dot-active');
    expect(rows[0].find('.dot').attributes('aria-label')).toBe('Active');
    expect(rows[0].text()).toContain('-$50.00');
    expect(rows[0].text()).toContain('Check');
    expect(rows[0].text()).toContain(formatDate('2026-11-15'));
    expect(rows[1].find('.dot').classes()).not.toContain('dot-active');
    expect(rows[1].find('.dot').attributes('aria-label')).toBe('Paused');
    expect(rows[1].text()).toContain('+$25.00');
    expect(rows[1].text()).toContain('Every 2 weeks');
    // Only credits are tinted: a debit's minus sign already says what it is.
    expect(rows[0].get('td.amount').classes()).not.toContain('text-danger');
    expect(rows[0].get('td.amount').classes()).not.toContain('text-success');
    expect(rows[1].get('td.amount').classes()).toContain('text-success');
  });

  it('signs and tints a zero debit as a debit, not by its falsy amount', async () => {
    mockGet({
      schedulers: {
        items: [scheduler({ id: 's1', debit: 0, credit: null })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const amount = wrapper.get('[data-testid="scheduler-row"] td.amount');
    expect(amount.text()).toBe('-$0.00');
    expect(amount.classes()).not.toContain('text-success');
  });

  it('shows the next occurrence rather than the first, and why there is none when paused or ended', async () => {
    mockGet({
      schedulers: {
        items: [
          scheduler({ id: 's1', valueDate: '2026-07-05', nextOccurrence: '2026-11-05' }),
          scheduler({ id: 's2', active: false, nextOccurrence: null }),
          scheduler({ id: 's3', limitDate: '2026-03-01', nextOccurrence: null }),
        ],
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('thead').text()).toContain('Next occurrence');
    expect(wrapper.find('thead').text()).not.toContain('First occurrence');
    const cells = wrapper.findAll('[data-testid="scheduler-next-occurrence"]');
    expect(cells[0].text()).toBe(formatDate('2026-11-05'));
    expect(cells[0].text()).not.toContain(formatDate('2026-07-05'));
    expect(cells[1].text()).toBe('Paused');
    expect(cells[2].text()).toBe('Ended');
  });

  it('shows the limit date compactly under the frequency when one is set, and nothing when not', async () => {
    mockGet({
      schedulers: {
        items: [
          scheduler({ id: 's1', limitDate: '2026-12-31' }),
          scheduler({ id: 's2', limitDate: null }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="scheduler-row"]');
    expect(rows[0].text()).toContain(`until ${formatDate('2026-12-31')}`);
    expect(rows[1].text()).not.toContain('until');
  });

  it('shows the frequency under the third party below md and in its own column from md up', async () => {
    mockGet({
      schedulers: {
        items: [scheduler({ id: 's1', thirdParty: 'Landlord', limitDate: '2026-12-31' })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const row = wrapper.get('[data-testid="scheduler-row"]');
    const mobile = row.get('div.d-md-none');
    expect(mobile.text()).toContain('Every month');
    expect(mobile.text()).toContain(`until ${formatDate('2026-12-31')}`);

    const column = row
      .findAll('td.d-none.d-md-table-cell')
      .find((cell) => cell.text().includes('Every month'));
    expect(column).toBeDefined();
    expect(column!.text()).toContain(`until ${formatDate('2026-12-31')}`);

    const header = wrapper.findAll('thead th').find((th) => th.text() === 'Frequency');
    expect(header?.classes()).toEqual(expect.arrayContaining(['d-none', 'd-md-table-cell']));
    expect(row.find('button').exists()).toBe(true);
  });

  it('opens the edit form when a row is clicked', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="scheduler-row"]').trigger('click');
    expect(wrapper.find('#scheduler-third-party').exists()).toBe(true);
  });

  it('deletes the scheduler being edited, closes the drawer and reloads the list', async () => {
    mockGet({ schedulers: { items: [scheduler({ id: 's1' })], total: 1, page: 1, pageSize: 20 } });
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="scheduler-row"]').trigger('click');
    const getCallsBefore = apiClient.GET.mock.calls.length;

    await wrapper.findComponent(SchedulerForm).find('button.btn-outline-danger').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/schedulers/{id}', {
      params: { path: { id: 's1' } },
    });
    expect(wrapper.find('#scheduler-third-party').exists()).toBe(false);
    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('paginates: Previous/Next are bounded, and Next re-queries the next page', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.text()).toContain('Page 1 of 3');
    const [prev, next] = wrapper.findAll('nav button');
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();

    await next.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
      params: { query: { accountId: ACCOUNT_ID, page: 2 } },
    });

    await prev.trigger('click');
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
      params: { query: { accountId: ACCOUNT_ID, page: 1 } },
    });
  });

  it('starts from the ?page= query param', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 45, page: 3, pageSize: 20 } });
    await router.push({
      name: 'schedulers',
      params: { accountId: ACCOUNT_ID },
      query: { page: '3' },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
      params: { query: { accountId: ACCOUNT_ID, page: 3 } },
    });
  });

  it.each([['0'], ['-1'], ['abc'], [undefined]])(
    'normalizes an invalid ?page=%s to page 1',
    async (raw) => {
      mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
      await router.push({
        name: 'schedulers',
        params: { accountId: ACCOUNT_ID },
        query: raw === undefined ? {} : { page: raw },
      });
      wrapper = mount(SchedulersPage, withGlobalPlugins(router));
      await flushPromises();

      expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
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
        if (path === '/schedulers') {
          return ok({
            items: [scheduler()],
            total: 45,
            page: options?.params?.query?.page ?? 1,
            pageSize: 20,
          });
        }
        return ok(undefined);
      },
    );
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    const replaceSpy = vi.spyOn(router, 'replace');
    const pushSpy = vi.spyOn(router, 'push');

    // Re-found after each click: the brief isPending loading state while
    // fetching a never-before-seen page tears down and rebuilds the pager.
    await wrapper.findAll('nav button')[1].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBe('2');
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();

    await wrapper.findAll('nav button')[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBeUndefined();
  });

  it('resets to page 1 when navigating to a different account', async () => {
    const ACCOUNT_ID_2 = '00000000-0000-7000-8000-000000000402';
    mockGet({ schedulers: { items: [scheduler()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const [, next] = wrapper.findAll('nav button');
    await next.trigger('click');
    await flushPromises();
    expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
      params: { query: { accountId: ACCOUNT_ID, page: 2 } },
    });

    await router.push({ name: 'schedulers', params: { accountId: ACCOUNT_ID_2 } });
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith('/schedulers', {
      params: { query: { accountId: ACCOUNT_ID_2, page: 1 } },
    });
  });

  it('shows batch actions once rows are selected, and reloads after a batch delete', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: { deletedCount: 1 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]').setValue(true);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(true);

    const getCallsBefore = apiClient.GET.mock.calls.length;
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it('invalidates every cached page (not just the current one), plus the account data a scheduler can generate, after a batch delete', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: { deletedCount: 1 },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const { global, queryClient } = withGlobalPlugins(router);
    wrapper = mount(SchedulersPage, { global });
    await flushPromises();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]').setValue(true);
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey?: unknown } | undefined)?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.schedulers.all(ACCOUNT_ID));
    // A scheduler save/delete queues background generation of operations on
    // this account, so its operations/chart/balances need invalidating too.
    expect(invalidatedKeys).toContainEqual(queryKeys.operations.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.chart.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.accounts);
  });

  it('creates a scheduler and closes the form on save', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('#scheduler-third-party').exists()).toBe(true);

    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(wrapper.find('#scheduler-third-party').exists()).toBe(false);
  });

  it('invalidates the account data a scheduler can generate after saving', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const { global, queryClient } = withGlobalPlugins(router);
    wrapper = mount(SchedulersPage, { global });
    await flushPromises();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.find('#scheduler-third-party').setValue('Landlord');
    await wrapper.find('#scheduler-amount').setValue('50');
    await wrapper.find('#scheduler-payment-method').setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey?: unknown } | undefined)?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.schedulers.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.operations.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.chart.all(ACCOUNT_ID));
    expect(invalidatedKeys).toContainEqual(queryKeys.accounts);
  });

  it('cancels the create form without saving', async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('#scheduler-third-party').exists()).toBe(true);

    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.find('#scheduler-third-party').exists()).toBe(false);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('hides batch actions again once every row is deselected', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(true);

    await checkbox.setValue(false);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(false);
  });

  it('names the row checkbox after its third party', async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]');
    expect(checkbox.attributes('aria-label')).toBe('Select Landlord');
  });

  it('selects every scheduler via the header checkbox, and clears them again when toggled off', async () => {
    mockGet({
      schedulers: {
        items: [scheduler({ id: 's1' }), scheduler({ id: 's2' })],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const headerCheckbox = () => wrapper!.find('thead input[type="checkbox"]');
    expect(headerCheckbox().attributes('aria-label')).toBe('Select all on this page');

    await headerCheckbox().setValue(true);
    const rowCheckboxes = wrapper.findAll('[data-testid="scheduler-row"] input[type="checkbox"]');
    expect(rowCheckboxes.every((c) => (c.element as HTMLInputElement).checked)).toBe(true);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(true);

    await headerCheckbox().setValue(false);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(false);
  });

  it('marks the header checkbox indeterminate when only some schedulers are selected', async () => {
    mockGet({
      schedulers: {
        items: [scheduler({ id: 's1' }), scheduler({ id: 's2' })],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.findAll('[data-testid="scheduler-row"] input[type="checkbox"]')[0].setValue(true);

    const headerCheckbox = wrapper.find('thead input[type="checkbox"]').element as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(true);
    expect(headerCheckbox.checked).toBe(false);
  });
});
