import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useConfirm } from '../composables/useConfirm';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import ConfirmModal from './ConfirmModal.vue';

// ConfirmDialog's Escape and focus-trap listeners live on `window`, so a
// dialog left mounted by one test would still react to the next test's key
// presses — tracked here and torn down after each test instead. Attached to
// the document throughout: focus assertions need a real activeElement.
const mounted = new Set<VueWrapper>();

function mountModal() {
  const wrapper = mount(ConfirmModal, { ...withGlobalPlugins(), attachTo: document.body });
  mounted.add(wrapper);
  return wrapper;
}

describe('ConfirmModal', () => {
  beforeEach(() => {
    // Module-singleton state (one dialog for the whole app) — drain any
    // pending confirmation left over from a previous test before each one.
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount());
    mounted.clear();
    document.body.innerHTML = '';
  });

  it('renders nothing when no confirmation is pending', () => {
    const wrapper = mountModal();
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('shows the given body under the generic title and Ok button, named and described for assistive tech', async () => {
    const wrapper = mountModal();
    void useConfirm().confirm({ body: 'Mark 2 operations as reconciled?' });
    await wrapper.vm.$nextTick();

    const dialog = wrapper.find('[role="dialog"]');
    const title = wrapper.find('h2.modal-title');
    const body = wrapper.find('.modal-body');

    expect(title.text()).toBe('Confirmation');
    expect(body.text()).toBe('Mark 2 operations as reconciled?');
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Ok', 'Cancel']);
    expect(wrapper.find('.modal-footer button').classes()).toContain('btn-primary');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe(title.attributes('id'));
    expect(dialog.attributes('aria-describedby')).toBe(body.attributes('id'));
  });

  it('shows the given title and confirm label, in red for a danger confirmation', async () => {
    const wrapper = mountModal();
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

  it('moves focus to Cancel once it opens', async () => {
    const wrapper = mountModal();
    void useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.find('button.btn-secondary').element);
  });

  it('keeps Tab focus inside the dialog, wrapping from Cancel back to Ok', async () => {
    const wrapper = mountModal();
    void useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));

    expect(document.activeElement).toBe(wrapper.find('button.btn-primary').element);
  });

  it('resolves true, hides and hands focus back to the opener once Ok is clicked', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mountModal();
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.vm.$nextTick();

    await expect(pending).resolves.toBe(true);
    expect(wrapper.find('.modal').exists()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('resolves false and hands focus back to the opener once Cancel is clicked', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mountModal();
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    await wrapper.find('button.btn-secondary').trigger('click');
    await wrapper.vm.$nextTick();

    await expect(pending).resolves.toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('resolves false, hides and hands focus back to the opener once Escape is pressed', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mountModal();
    const pending = useConfirm().confirm({ body: 'Delete it?' });
    await wrapper.vm.$nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    await expect(pending).resolves.toBe(false);
    expect(wrapper.find('.modal').exists()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('ignores Escape while no confirmation is pending', () => {
    const wrapper = mountModal();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(useConfirm().state.visible).toBe(false);
    expect(wrapper.find('.modal').exists()).toBe(false);
  });
});
