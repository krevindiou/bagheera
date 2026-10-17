import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import type { Operation } from '../../domain/referenceData';
import BatchActions from './batch.vue';

const apiClient = asMockedApiClient(realApiClient);

function operation(id: string, overrides: Partial<Operation> = {}): Operation {
  return {
    id,
    accountId: 'a1',
    schedulerId: null,
    transferOperationId: null,
    transferAccountId: null,
    categoryId: null,
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    thirdParty: 'Landlord',
    debit: 100,
    credit: null,
    valueDate: '2026-01-15',
    reconciled: false,
    notes: '',
    ...overrides,
  };
}

function operations(ids: string[]): Operation[] {
  return ids.map((id) => operation(id));
}

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

describe('BatchActions', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('renders nothing when nothing is selected', () => {
    const wrapper = mount(BatchActions, {
      ...withGlobalPlugins(),
      props: { selectedIds: [], operations: [] },
    });
    expect(wrapper.find('[data-testid="batch-actions"]').exists()).toBe(false);
  });

  describe('delete', () => {
    it('deletes the selected operations once confirmed', async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(200, { deletedCount: 2 }));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1', 'o2'], operations: operations(['o1', 'o2']) },
      });

      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      expect(useConfirm().state.options).toEqual({
        body: "Delete 2 operations? This can't be undone.",
        confirmLabel: 'Delete',
        danger: true,
      });
      useConfirm().settle(true);
      await flushPromises();

      expect(apiClient.POST).toHaveBeenCalledWith('/operations/batch/delete', {
        body: { ids: ['o1', 'o2'] },
      });
      expect(useToast().toasts[0]?.text).toBe('Operations deleted');
      expect(wrapper.emitted('done')).toHaveLength(1);
    });

    it('says transfer counterparts stay as external operations when the selection has a transfer', async () => {
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: {
          selectedIds: ['o1', 'o2'],
          operations: [
            operation('o1'),
            operation('o2', { transferOperationId: 'o9', transferAccountId: 'a2' }),
            operation('o3', { transferOperationId: 'o8', transferAccountId: 'a2' }),
          ],
        },
      });

      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      expect(useConfirm().state.options).toEqual({
        body: "Delete 2 operations? The counterparts of their transfers stay in the other accounts, as external operations. This can't be undone.",
        confirmLabel: 'Delete',
        danger: true,
      });
    });

    it('keeps the plain wording when the selected rows are no transfers', async () => {
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: {
          selectedIds: ['o1'],
          operations: [
            operation('o1'),
            operation('o2', { transferOperationId: 'o9', transferAccountId: 'a2' }),
          ],
        },
      });

      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      expect(useConfirm().state.options?.body).toBe("Delete 1 operation? This can't be undone.");
    });

    it('does nothing when the confirmation is cancelled', async () => {
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      useConfirm().settle(false);

      expect(apiClient.POST).not.toHaveBeenCalled();
      expect(wrapper.emitted('done')).toBeUndefined();
    });

    it('shows an error but still closes when the server deletes nothing', async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(200, { deletedCount: 0 }));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      useConfirm().settle(true);
      await flushPromises();

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('done')).toHaveLength(1);
    });

    it("shows an error and doesn't close when the request itself fails", async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(400));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-delete"]').trigger('click');
      useConfirm().settle(true);
      await flushPromises();

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('done')).toBeUndefined();
    });
  });

  describe('reconcile', () => {
    it('reconciles the selected operations once confirmed', async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(200, { reconciledCount: 1 }));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-reconcile"]').trigger('click');
      expect(useConfirm().state.options).toEqual({
        body: 'Mark 1 operation as reconciled?',
        confirmLabel: 'Reconcile',
        danger: undefined,
      });
      useConfirm().settle(true);
      await flushPromises();

      expect(apiClient.POST).toHaveBeenCalledWith('/operations/batch/reconcile', {
        body: { ids: ['o1'] },
      });
      expect(useToast().toasts[0]?.text).toBe('Operations reconciled');
      expect(wrapper.emitted('done')).toHaveLength(1);
    });

    it('shows an error but still closes when the server reconciles nothing', async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(200, { reconciledCount: 0 }));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-reconcile"]').trigger('click');
      useConfirm().settle(true);
      await flushPromises();

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('done')).toHaveLength(1);
    });

    it("shows an error and doesn't close when the request itself fails", async () => {
      apiClient.POST.mockResolvedValueOnce(jsonResult(400));
      const wrapper = mount(BatchActions, {
        ...withGlobalPlugins(),
        props: { selectedIds: ['o1'], operations: operations(['o1']) },
      });
      await wrapper.find('[data-testid="batch-reconcile"]').trigger('click');
      useConfirm().settle(true);
      await flushPromises();

      expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
      expect(wrapper.emitted('done')).toBeUndefined();
    });
  });
});
