import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { submitAndSettle } from '../../test-support/submitAndSettle';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import type { Bank } from './accounts.types';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import EditBankForm from './EditBankForm.vue';

const apiClient = asMockedApiClient(realApiClient);

const bank: Bank = { id: 'b1', name: 'Chase', closed: false, deleted: false };

describe('EditBankForm', () => {
  beforeEach(() => {
    apiClient.PATCH.mockReset();
    useToast().toasts.splice(0);
  });

  it('prefills the name from the bank', () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    expect((wrapper.find('#bank-name').element as HTMLInputElement).value).toBe('Chase');
  });

  it('renames the bank and emits saved', async () => {
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('#bank-name').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith('/banks/{id}', {
      params: { path: { id: 'b1' } },
      body: { name: 'Chase Bank' },
    });
    expect(useToast().toasts[0]?.text).toBe('Bank saved');
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it("shows the API's error message and doesn't emit when the rename fails", async () => {
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'Name already used' },
      response: new Response(null, { status: 400 }),
    });
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('#bank-name').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Name already used');
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('falls back to a generic error toast when the rename fails without a message', async () => {
    apiClient.PATCH.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('#bank-name').setValue('Chase Bank');
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
  });

  it("shows a validation error and doesn't submit for an empty name", async () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('#bank-name').setValue('');
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain('This field is required.');
    expect(apiClient.PATCH).not.toHaveBeenCalled();
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel when the backdrop is clicked', async () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('.drawer-backdrop').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel when the drawer close button is clicked', async () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    await wrapper.find('.drawer-close').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel when Escape is pressed', () => {
    const wrapper = mount(EditBankForm, { ...withGlobalPlugins(), props: { bank } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
