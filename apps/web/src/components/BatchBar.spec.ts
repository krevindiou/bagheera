import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { useConfirm } from '../composables/useConfirm';
import { useToast } from '../composables/useToast';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import BatchBar, { type BatchAction } from './BatchBar.vue';

// Real i18n keys, so labels and toasts read as the app's actual copy.
function deleteAction(overrides: Partial<BatchAction> = {}): BatchAction {
  return {
    labelKey: 'schedulers.batch.delete',
    successKey: 'schedulers.batch.deleted',
    errorKey: 'schedulers.genericError',
    testid: 'delete',
    danger: true,
    run: vi.fn().mockResolvedValue(2),
    ...overrides,
  };
}

function mountBar(actions: BatchAction[], selectedIds = ['s1', 's2']) {
  return mount(BatchBar, {
    ...withGlobalPlugins(),
    props: { selectedIds, actions },
    attrs: { 'data-testid': 'bar' },
  });
}

async function clickAndSettle(wrapper: VueWrapper, testid: string, confirmed: boolean) {
  await wrapper.find(`[data-testid="${testid}"]`).trigger('click');
  useConfirm().settle(confirmed);
  await flushPromises();
}

function toasts(): [string, string][] {
  return useToast().toasts.map((toast) => [toast.text, toast.variant]);
}

describe('BatchBar', () => {
  beforeEach(() => {
    useToast().toasts.splice(0);
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('renders nothing while nothing is selected', () => {
    const wrapper = mountBar([deleteAction()], []);
    expect(wrapper.find('[data-testid="bar"]').exists()).toBe(false);
  });

  it('renders one button per action on the bar, danger actions in red', () => {
    const reconcile = deleteAction({
      labelKey: 'operations.batch.reconcile',
      testid: 'reconcile',
      danger: false,
    });
    const wrapper = mountBar([deleteAction(), reconcile]);

    expect(wrapper.find('[data-testid="bar"]').classes()).toContain('batch-bar');
    const buttons = wrapper.findAll('button');
    expect(buttons.map((button) => button.text())).toEqual([
      'Delete selected',
      'Reconcile selected',
    ]);
    expect(buttons[0].classes()).toContain('btn-outline-danger');
    expect(buttons[1].classes()).toContain('btn-outline-secondary');
  });

  it('runs the action on the selected ids once confirmed, then toasts success', async () => {
    const run = vi.fn().mockResolvedValue(2);
    const wrapper = mountBar([deleteAction({ run })]);

    await clickAndSettle(wrapper, 'delete', true);

    expect(run).toHaveBeenCalledWith(['s1', 's2']);
    expect(toasts()).toEqual([['Schedulers deleted', 'success']]);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const run = vi.fn();
    const wrapper = mountBar([deleteAction({ run })]);

    await clickAndSettle(wrapper, 'delete', false);

    expect(run).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
    expect(wrapper.emitted('done')).toBeUndefined();
  });

  it('toasts an error, but still emits done, when the server changed nothing', async () => {
    const wrapper = mountBar([deleteAction({ run: vi.fn().mockResolvedValue(0) })]);

    await clickAndSettle(wrapper, 'delete', true);

    expect(toasts()).toEqual([['Something went wrong. Please try again.', 'error']]);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it("toasts an error and doesn't emit done when the request fails", async () => {
    const wrapper = mountBar([deleteAction({ run: vi.fn().mockResolvedValue(null) })]);

    await clickAndSettle(wrapper, 'delete', true);

    expect(toasts()).toEqual([['Something went wrong. Please try again.', 'error']]);
    expect(wrapper.emitted('done')).toBeUndefined();
  });
});
