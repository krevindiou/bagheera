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
    confirmKey: 'schedulers.batch.confirmDelete',
    confirmLabelKey: 'common.delete',
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

  it('announces the selection count as a polite live region, pluralized on the count', () => {
    const wrapper = mountBar([deleteAction()], ['s1']);
    const status = wrapper.find('[role="status"]');
    expect(status.text()).toBe('1 selected');

    const two = mountBar([deleteAction()], ['s1', 's2']);
    expect(two.find('[role="status"]').text()).toBe('2 selected');
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

  it("asks to confirm with the action's own text, pluralized on the selection size", async () => {
    const wrapper = mountBar([deleteAction()]);

    await wrapper.find('[data-testid="delete"]').trigger('click');

    expect(useConfirm().state.options).toEqual({
      body: 'Delete 2 scheduled operations? The operations they already created are kept.',
      confirmLabel: 'Delete',
      danger: true,
    });
  });

  it('picks the confirmation key from the selected ids when given a function', async () => {
    const confirmKey = vi.fn().mockReturnValue('operations.batch.confirmReconcile');
    const wrapper = mountBar([deleteAction({ confirmKey })], ['o1']);

    await wrapper.find('[data-testid="delete"]').trigger('click');

    expect(confirmKey).toHaveBeenCalledWith(['o1']);
    expect(useConfirm().state.options?.body).toBe('Mark 1 operation as reconciled?');
  });

  it('confirms a single selected row in the singular, without danger for a non-danger action', async () => {
    const reconcile = deleteAction({
      confirmKey: 'operations.batch.confirmReconcile',
      confirmLabelKey: 'operations.batch.reconcileConfirmLabel',
      testid: 'reconcile',
      danger: false,
    });
    const wrapper = mountBar([reconcile], ['o1']);

    await wrapper.find('[data-testid="reconcile"]').trigger('click');

    expect(useConfirm().state.options).toEqual({
      body: 'Mark 1 operation as reconciled?',
      confirmLabel: 'Reconcile',
      danger: false,
    });
  });

  it('runs the action on the selected ids once confirmed, then toasts success', async () => {
    const run = vi.fn().mockResolvedValue(2);
    const wrapper = mountBar([deleteAction({ run })]);

    await clickAndSettle(wrapper, 'delete', true);

    expect(run).toHaveBeenCalledWith(['s1', 's2']);
    expect(toasts()).toEqual([['Scheduled operations deleted', 'success']]);
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
