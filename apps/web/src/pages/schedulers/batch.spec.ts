import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import BatchActions from './batch.vue';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number) {
  return { data: undefined, error: undefined, response: new Response(null, { status }) };
}

describe('schedulers BatchActions', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('renders nothing when nothing is selected', () => {
    const wrapper = mount(BatchActions, { ...withGlobalPlugins(), props: { selectedIds: [] } });
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(false);
  });

  it('deletes the selected schedulers once confirmed', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(BatchActions, {
      ...withGlobalPlugins(),
      props: { selectedIds: ['s1', 's2'] },
    });
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/schedulers/batch/delete', {
      body: { ids: ['s1', 's2'] },
    });
    expect(useToast().toasts[0]?.text).toBe('Schedulers deleted');
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const wrapper = mount(BatchActions, {
      ...withGlobalPlugins(),
      props: { selectedIds: ['s1'] },
    });
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger('click');
    useConfirm().settle(false);

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.emitted('done')).toBeUndefined();
  });

  it("shows an error and doesn't emit done when the request fails", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400));
    const wrapper = mount(BatchActions, {
      ...withGlobalPlugins(),
      props: { selectedIds: ['s1'] },
    });
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger('click');
    useConfirm().settle(true);
    await flushPromises();

    expect(useToast().toasts[0]?.text).toBe('Something went wrong. Please try again.');
    expect(wrapper.emitted('done')).toBeUndefined();
  });
});
