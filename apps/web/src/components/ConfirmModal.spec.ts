import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { useConfirm } from '../composables/useConfirm';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import ConfirmModal from './ConfirmModal.vue';

describe('ConfirmModal', () => {
  // Module-singleton state (one dialog for the whole app) — drain any
  // pending confirmation left over from a previous test before each one.
  beforeEach(() => {
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  it('renders nothing when no confirmation is pending', () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('shows the given body under the generic title and Ok button when nothing else is set', async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    void useConfirm().confirm({ body: 'Mark 2 operations as reconciled?' });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.modal-title').text()).toBe('Confirmation');
    expect(wrapper.find('.modal-body').text()).toBe('Mark 2 operations as reconciled?');
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Ok', 'Cancel']);
    expect(wrapper.find('.modal-footer button').classes()).toContain('btn-primary');
  });

  it('shows the given title and confirm label, in red for a danger confirmation', async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    void useConfirm().confirm({
      title: 'Delete account',
      body: 'Delete account “Checking”?',
      confirmLabel: 'Delete',
      danger: true,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.modal-title').text()).toBe('Delete account');
    expect(wrapper.find('.modal-body').text()).toBe('Delete account “Checking”?');
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Delete', 'Cancel']);
    const accept = wrapper.find('.modal-footer button');
    expect(accept.classes()).toContain('btn-danger');
    expect(accept.classes()).not.toContain('btn-primary');
  });

  it('resolves true and hides once Ok is clicked', async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    await wrapper.find('button.btn-primary').trigger('click');

    await expect(pending).resolves.toBe(true);
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('resolves false once Cancel is clicked', async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    await wrapper.find('button.btn-secondary').trigger('click');

    await expect(pending).resolves.toBe(false);
  });

  it('resolves false and hides once Escape is pressed', async () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(pending).resolves.toBe(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('ignores Escape while no confirmation is pending', () => {
    const wrapper = mount(ConfirmModal, withGlobalPlugins());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(useConfirm().state.visible).toBe(false);
    expect(wrapper.find('.modal').exists()).toBe(false);
  });
});
