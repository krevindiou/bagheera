import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import type { Account, Bank } from './accounts.types';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import CreateAccountForm from './CreateAccountForm.vue';

const apiClient = asMockedApiClient(realApiClient);

const banks: Bank[] = [{ id: 'b1', name: 'Chase', closed: false, deleted: false }];

describe('CreateAccountForm', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    apiClient.PATCH.mockReset();
    useToast().toasts.splice(0);
  });

  describe('create mode', () => {
    it('creates an account and emits created with the new id', async () => {
      apiClient.POST.mockResolvedValueOnce({
        data: { account: { id: 'new-account' } },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, bankId: 'b1' },
      });
      await wrapper.find('#account-name').setValue('Checking');
      await wrapper.find('#account-currency').setValue('USD');
      await submitAndSettle(wrapper);

      expect(apiClient.POST).toHaveBeenCalledWith('/accounts', {
        body: { bankId: 'b1', name: 'Checking', currency: 'USD', initialBalance: undefined },
      });
      expect(wrapper.emitted('created')).toEqual([['new-account']]);
    });

    it("shows an error and doesn't emit when creation fails", async () => {
      apiClient.POST.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 400 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, bankId: 'b1' },
      });
      await wrapper.find('#account-name').setValue('Checking');
      await wrapper.find('#account-currency').setValue('USD');
      await submitAndSettle(wrapper);

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('created')).toBeUndefined();
    });

    it("shows the selected currency's symbol next to the initial balance field", async () => {
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, bankId: 'b1' },
      });
      await wrapper.find('#account-currency').setValue('USD');
      expect(wrapper.find('.input-group-text').text()).toBe('$');
    });

    it("shows the API's error message when creation fails", async () => {
      apiClient.POST.mockResolvedValueOnce({
        data: undefined,
        error: { message: 'Name already used' },
        response: new Response(null, { status: 400 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, bankId: 'b1' },
      });
      await wrapper.find('#account-name').setValue('Checking');
      await wrapper.find('#account-currency').setValue('USD');
      await submitAndSettle(wrapper);

      expect(useToast().toasts[0]?.text).toBe('Name already used');
    });

    it('submits the chosen bank and initial balance', async () => {
      const twoBanks: Bank[] = [
        ...banks,
        { id: 'b2', name: 'Savings Bank', closed: false, deleted: false },
      ];
      apiClient.POST.mockResolvedValueOnce({
        data: { account: { id: 'new-account' } },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks: twoBanks, bankId: 'b1' },
      });
      await wrapper.find('#account-bank').setValue('b2');
      await wrapper.find('#account-name').setValue('Checking');
      await wrapper.find('#account-currency').setValue('USD');
      await wrapper.find('#account-initial-balance').setValue('100.50');
      await submitAndSettle(wrapper);

      expect(apiClient.POST).toHaveBeenCalledWith('/accounts', {
        body: { bankId: 'b2', name: 'Checking', currency: 'USD', initialBalance: 100.5 },
      });
    });
  });

  describe('edit mode', () => {
    const account: Account = {
      id: 'a1',
      bankId: 'b1',
      name: 'Checking',
      currency: 'USD',
      closed: false,
      deleted: false,
    };

    it('prefills from the account and disables bank/currency, with no initial-balance field', () => {
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, mode: 'edit', account },
      });
      expect((wrapper.find('#account-name').element as HTMLInputElement).value).toBe('Checking');
      expect(wrapper.find('#account-bank').attributes('disabled')).toBeDefined();
      expect(wrapper.find('#account-currency').attributes('disabled')).toBeDefined();
      expect(wrapper.find('#account-initial-balance').exists()).toBe(false);
    });

    it('updates the account name and emits updated', async () => {
      apiClient.PATCH.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, mode: 'edit', account },
      });
      await wrapper.find('#account-name').setValue('Savings');
      await submitAndSettle(wrapper);

      expect(apiClient.PATCH).toHaveBeenCalledWith('/accounts/{id}', {
        params: { path: { id: 'a1' } },
        body: { name: 'Savings', bankId: 'b1', currency: 'USD' },
      });
      expect(wrapper.emitted('updated')).toEqual([[]]);
    });

    it("shows an error and doesn't emit when the update fails", async () => {
      apiClient.PATCH.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 400 }),
      });
      const wrapper = mount(CreateAccountForm, {
        ...withGlobalPlugins(),
        props: { banks, mode: 'edit', account },
      });
      await wrapper.find('#account-name').setValue('Savings');
      await submitAndSettle(wrapper);

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('updated')).toBeUndefined();
    });
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(CreateAccountForm, {
      ...withGlobalPlugins(),
      props: { banks, bankId: 'b1' },
    });
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
