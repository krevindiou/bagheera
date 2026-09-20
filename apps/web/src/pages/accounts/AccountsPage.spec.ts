import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from './accounts.types';
import AccountsPage from './AccountsPage.vue';
import CreateAccountForm from './CreateAccountForm.vue';
import EditBankForm from './EditBankForm.vue';

const apiClient = asMockedApiClient(realApiClient);

// A dedicated stub router instead of the real singleton: "accounts" has
// meta.requiresAuth on the real route table, so pushing there without an
// authenticated session would silently redirect to sign-in via the real
// guard — this component only needs "accounts"/"operations" to resolve.
function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts', name: 'accounts', component: stub },
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
    ],
  });
}

const bank = (id: string, name: string, closed = false, deleted = false): Bank => ({
  id,
  name,
  closed,
  deleted,
});
const account = (
  id: string,
  bankId: string,
  name: string,
  currency = 'USD',
  closed = false,
  deleted = false,
  balance = 0,
  reconciledBalance = 0,
): Account => ({ id, bankId, name, currency, closed, deleted, balance, reconciledBalance });

function mockData(banks: Bank[], accounts: Account[]) {
  apiClient.GET.mockImplementation(async (path: string) => {
    if (path === '/banks') return { data: banks, error: undefined, response: new Response() };
    if (path === '/accounts') return { data: accounts, error: undefined, response: new Response() };
    return { data: undefined, error: undefined, response: new Response() };
  });
}

describe('AccountsPage', () => {
  let router: Router;

  beforeEach(() => {
    router = createTestRouter();
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    apiClient.PATCH.mockReset();
    apiClient.DELETE.mockReset();
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('shows the empty state and a New account button when there are no banks', async () => {
    mockData([], []);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.text()).toContain("You don't have any bank yet.");
    expect(wrapper.find('button.btn-primary').text()).toBe('+ New account');
  });

  it('lists banks and accounts, with closed badges and a no-accounts message', async () => {
    mockData(
      [bank('b1', 'Chase'), bank('b2', 'Old Bank', true)],
      [account('a1', 'b1', 'Checking')],
    );
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="bank-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Chase');
    expect(rows[0].find('[data-testid="account-row"]').text()).toContain('Checking (USD)');
    expect(rows[1].text()).toContain('Old Bank');
    expect(rows[1].find('.pill').text()).toBe('Closed');
    expect(rows[1].text()).toContain('No account');
  });

  it("shows each account's balance", async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking', 'USD', false, false, 1200.4)]);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('[data-testid="account-balance"]').text()).toBe('$1,200.40');
  });

  it("shows each account's reconciled balance in its own column", async () => {
    mockData(
      [bank('b1', 'Chase')],
      [account('a1', 'b1', 'Checking', 'USD', false, false, 1200.4, 1000)],
    );
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.find('[data-testid="account-balance"]').text()).toBe('$1,200.40');
    expect(wrapper.find('[data-testid="account-reconciled-balance"]').text()).toBe('$1,000.00');
  });

  it('shows the bank-choice step, then account creation scoped to the chosen bank; cancel returns to the button', async () => {
    mockData([bank('b1', 'Chase')], []);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('#account-bank-id').exists()).toBe(true);

    await wrapper.find('#account-bank-id').setValue('b1');
    await submitAndSettle(wrapper);
    await flushPromises();

    expect((wrapper.find('#account-bank').element as HTMLSelectElement).value).toBe('b1');

    // Scoped to the form: bank rows also carry a "btn-outline-secondary"
    // Edit button, so an unscoped selector would hit that one first.
    await wrapper.find('form button.btn-outline-secondary').trigger('click');
    expect(wrapper.find('#account-name').exists()).toBe(false);
    expect(wrapper.find('button.btn-primary').exists()).toBe(true);
  });

  it('opens the bank-choice step via the ?start=bank-choice deep link', async () => {
    mockData([bank('b1', 'Chase')], []);
    await router.push({ name: 'accounts', query: { start: 'bank-choice' } });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));

    // The deep-link watch only fires once banksQuery.data actually resolves,
    // which takes more hops than a single flushPromises() round — poll
    // instead (same reasoning as elsewhere in this suite).
    await vi.waitFor(() => {
      if (!wrapper.find('#account-bank-id').exists()) throw new Error('not opened yet');
    });
  });

  it('opens account creation for the first active bank via the ?start=new-account deep link, and navigates on success', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.POST.mockResolvedValueOnce({
      data: { account: { id: 'new-account' } },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts', query: { start: 'new-account' } });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await vi.waitFor(() => {
      if (!wrapper.find('#account-bank').exists()) throw new Error('not opened yet');
    });

    expect((wrapper.find('#account-bank').element as HTMLSelectElement).value).toBe('b1');

    await wrapper.find('#account-name').setValue('Checking');
    await wrapper.find('#account-currency').setValue('USD');
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);
    await submitAndSettle(wrapper);

    expect(pushSpy).toHaveBeenCalledWith({
      name: 'operations',
      params: { accountId: 'new-account' },
    });
  });

  it("edits a bank's name", async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.find('button').trigger('click'); // Edit is listed first
    // The edit form now renders as a page-level drawer rather than inline
    // in the row — scope to the component instance rather than the row.
    await wrapper.findComponent(EditBankForm).find('input').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/banks/{id}', {
      params: { path: { id: 'b1' } },
      body: { name: 'Chase Bank' },
    });
    expect(wrapper.text()).toContain('Bank saved');
    expect(wrapper.findComponent(EditBankForm).exists()).toBe(false);
  });

  it('closes a bank once the confirmation is accepted', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.findAll('button')[1].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/banks/{id}/close', {
      params: { path: { id: 'b1' } },
    });
    expect(wrapper.text()).toContain('Bank closed');
  });

  it("doesn't delete a bank when the confirmation is cancelled", async () => {
    mockData([bank('b1', 'Chase')], []);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.findAll('button')[2].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.DELETE).not.toHaveBeenCalled();
  });

  it("navigates to an account's operations when its row is clicked", async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);

    await wrapper.find('[data-testid="account-row"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith({ name: 'operations', params: { accountId: 'a1' } });
  });

  it("shows the API's error message when editing a bank's name fails", async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Name already used' },
      response: new Response(null, { status: 400 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.find('button').trigger('click'); // Edit
    await wrapper.findComponent(EditBankForm).find('input').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Name already used');
    expect(wrapper.findComponent(EditBankForm).exists()).toBe(true); // stays in edit mode
  });

  it('falls back to a generic error toast when editing a bank fails without a message', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.find('button').trigger('click'); // Edit
    await wrapper.findComponent(EditBankForm).find('input').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it("cancels editing a bank's name without saving", async () => {
    mockData([bank('b1', 'Chase')], []);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.find('button').trigger('click'); // Edit
    await wrapper.findComponent(EditBankForm).find('button.btn-outline-secondary').trigger('click'); // Cancel
    expect(wrapper.findComponent(EditBankForm).exists()).toBe(false);
    expect(apiClient.PATCH).not.toHaveBeenCalled();
  });

  it('shows an error toast when closing a bank fails', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.findAll('button')[1].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it('deletes a bank once the confirmation is accepted', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.findAll('button')[2].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/banks/{id}', {
      params: { path: { id: 'b1' } },
    });
    expect(wrapper.text()).toContain('Bank deleted');
  });

  it('shows an error toast when deleting a bank fails', async () => {
    mockData([bank('b1', 'Chase')], []);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const chaseRow = wrapper.findAll('[data-testid="bank-row"]')[0];
    await chaseRow.findAll('button')[2].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it('edits an account and closes the edit form once the update completes', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="account-row"] .btn-outline-secondary').trigger('click'); // Edit
    await wrapper.find('#account-name').setValue('Checking Plus');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/accounts/{id}', {
      params: { path: { id: 'a1' } },
      body: { name: 'Checking Plus', bankId: 'b1', currency: 'USD' },
    });
    expect(wrapper.find('#account-name').exists()).toBe(false); // edit form closed
  });

  it('cancels editing an account without saving', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="account-row"] .btn-outline-secondary').trigger('click'); // Edit
    expect(wrapper.find('#account-name').exists()).toBe(true);

    // The edit form now renders as a page-level drawer rather than inline
    // in the row — scope to the component instance rather than a class.
    await wrapper
      .findComponent(CreateAccountForm)
      .find('button.btn-outline-secondary')
      .trigger('click'); // Cancel
    expect(wrapper.find('#account-name').exists()).toBe(false);
    expect(apiClient.PATCH).not.toHaveBeenCalled();
  });

  it('closes an account once the confirmation is accepted', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const buttons = wrapper.findAll('[data-testid="account-row"] button');
    await buttons[1].trigger('click'); // Edit, Close, Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/accounts/{id}/close', {
      params: { path: { id: 'a1' } },
    });
    expect(wrapper.text()).toContain('Account closed');
  });

  it('shows an error toast when closing an account fails', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const buttons = wrapper.findAll('[data-testid="account-row"] button');
    await buttons[1].trigger('click'); // Close
    useConfirm().settle(true);
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it('deletes an account once the confirmation is accepted', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const buttons = wrapper.findAll('[data-testid="account-row"] button');
    await buttons[2].trigger('click'); // Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.DELETE).toHaveBeenCalledWith('/accounts/{id}', {
      params: { path: { id: 'a1' } },
    });
    expect(wrapper.text()).toContain('Account deleted');
  });

  it('shows an error toast when deleting an account fails', async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    apiClient.DELETE.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();

    const buttons = wrapper.findAll('[data-testid="account-row"] button');
    await buttons[2].trigger('click'); // Delete
    useConfirm().settle(true);
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong. Please try again.');
  });

  it("doesn't navigate when a control inside the account row is clicked", async () => {
    mockData([bank('b1', 'Chase')], [account('a1', 'b1', 'Checking')]);
    await router.push({ name: 'accounts' });
    const wrapper = mount(AccountsPage, withGlobalPlugins(router));
    await flushPromises();
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined);

    // This is the row's Edit button — clicking it must not also navigate.
    await wrapper.find('[data-testid="account-row"] .btn-outline-secondary').trigger('click');
    expect(pushSpy).not.toHaveBeenCalledWith({ name: 'operations', params: { accountId: 'a1' } });
  });
});
