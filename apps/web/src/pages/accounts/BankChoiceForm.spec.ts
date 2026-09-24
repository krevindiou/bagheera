import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import type { Bank } from './accounts.types';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import BankChoiceForm from './BankChoiceForm.vue';

const apiClient = asMockedApiClient(realApiClient);

const banks: Bank[] = [{ id: 'b1', name: 'Chase', closed: false, deleted: false }];

describe('BankChoiceForm', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it('emits chosen with the selected bank id, without calling the API', async () => {
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('#account-bank-id').setValue('b1');
    await submitAndSettle(wrapper);

    expect(wrapper.emitted('chosen')).toEqual([['b1']]);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('creates a new bank and emits chosen with the created id', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: { id: 'new-bank' },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('#account-bank-name').setValue('New Bank');
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith('/banks/choice', { body: { name: 'New Bank' } });
    expect(wrapper.emitted('chosen')).toEqual([['new-bank']]);
  });

  it("shows an error and doesn't emit when bank creation fails", async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Bank name already used' },
      response: new Response(null, { status: 400 }),
    });
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('#account-bank-name').setValue('New Bank');
    await submitAndSettle(wrapper);

    // BankChoiceForm doesn't render a ToastContainer (only BaseLayout does,
    // once for the whole app), so a standalone mount here has nothing to
    // display the toast — check the shared toast state directly instead.
    expect(useToast().toasts[0]?.text).toBe('Bank name already used');
    expect(wrapper.emitted('chosen')).toBeUndefined();
  });

  it('falls back to a generic error toast when bank creation fails without a message', async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('#account-bank-name').setValue('New Bank');
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it('clears and disables the bank name once an existing bank is selected, and re-enables it once deselected', async () => {
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('#account-bank-name').setValue('New Bank');
    await wrapper.find('#account-bank-id').setValue('b1');
    const nameInput = wrapper.find('#account-bank-name').element as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(nameInput.disabled).toBe(true);

    await wrapper.find('#account-bank-id').setValue('');
    expect(nameInput.disabled).toBe(false);

    await wrapper.find('#account-bank-name').setValue('Another');
    expect((wrapper.find('#account-bank-id').element as HTMLSelectElement).value).toBe('');
  });

  it("shows a validation error and doesn't submit when neither field is filled", async () => {
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('You must select a bank.');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(BankChoiceForm, { ...withGlobalPlugins(), props: { banks } });
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
