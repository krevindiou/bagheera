import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../../test-support/mockApiClient';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';

vi.mock('../../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../../api/client';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import LabelCorrectionsPage from './LabelCorrectionsPage.vue';

const apiClient = asMockedApiClient(realApiClient);

const items = [
  { id: 'c1', sourceLabel: 'CB*1234 CARREFOUR', thirdParty: 'Carrefour' },
  { id: 'c2', sourceLabel: 'PRLV SEPA EDF', thirdParty: 'EDF' },
];

function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

async function mountPage(list = items) {
  apiClient.GET.mockResolvedValue(ok({ items: list, limit: 1000 }));
  const wrapper = mount(LabelCorrectionsPage, withGlobalPlugins());
  await flushPromises();
  return wrapper;
}

describe('LabelCorrectionsPage', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('lists the corrections with the label of the file and what replaces it', async () => {
    const wrapper = await mountPage();

    const rows = wrapper.findAll('[data-testid="label-correction-row"]');
    expect(
      rows.map((row) =>
        row
          .findAll('td')
          .slice(1)
          .map((cell) => cell.text()),
      ),
    ).toEqual([
      ['CB*1234 CARREFOUR', 'Carrefour'],
      ['PRLV SEPA EDF', 'EDF'],
    ]);
    expect(wrapper.find('[data-testid="label-corrections-count"]').text()).toBe(
      '2 of 1000 label corrections remembered',
    );
    expect(apiClient.GET).toHaveBeenCalledWith('/label-corrections');
  });

  it('says so when no correction is remembered', async () => {
    const wrapper = await mountPage([]);
    expect(wrapper.text()).toContain("You haven't remembered any label correction yet.");
    expect(wrapper.find('[data-testid="label-corrections-table"]').exists()).toBe(false);
  });

  it('shows the load error', async () => {
    apiClient.GET.mockResolvedValue({
      data: undefined,
      error: { message: 'x' },
      response: new Response(null, { status: 500 }),
    });
    const wrapper = mount(LabelCorrectionsPage, withGlobalPlugins());
    await flushPromises();
    expect(wrapper.find('[data-testid="label-corrections-error"]').exists()).toBe(true);
  });

  it('offers deletion only once a row is selected', async () => {
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="label-correction-delete"]').exists()).toBe(false);

    await wrapper.findAll('[data-testid="label-correction-row"] input')[0].setValue(true);

    expect(wrapper.find('[data-testid="label-correction-delete"]').exists()).toBe(true);
  });

  it('deletes the selected corrections once confirmed, then reloads the list', async () => {
    const wrapper = await mountPage();
    apiClient.POST.mockResolvedValueOnce(ok({ message: 'x', deletedCount: 2 }));
    await wrapper.find('thead input[type="checkbox"]').setValue(true);

    await wrapper.find('[data-testid="label-correction-delete"]').trigger('click');
    expect(useConfirm().state.options).toEqual({
      body: 'Delete 2 label corrections? Operations already imported are kept.',
      confirmLabel: 'Delete',
      danger: true,
    });
    apiClient.GET.mockResolvedValue(ok({ items: [], limit: 1000 }));
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith('/label-corrections/delete', {
      body: { ids: ['c1', 'c2'] },
    });
    expect(useToast().toasts[0]?.text).toBe('Label corrections deleted');
    expect(wrapper.find('[data-testid="label-correction-row"]').exists()).toBe(false);
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    const wrapper = await mountPage();
    await wrapper.findAll('[data-testid="label-correction-row"] input')[1].setValue(true);

    await wrapper.find('[data-testid="label-correction-delete"]').trigger('click');
    useConfirm().settle(false);
    await flushPromises();

    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('is one of the settings tabs', async () => {
    const wrapper = await mountPage();
    expect(wrapper.find('.tab-bar').text()).toContain('Label corrections');
  });
});
