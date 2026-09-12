import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { useToast } from '../composables/useToast';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import ToastContainer from './ToastContainer.vue';

describe('ToastContainer', () => {
  // Module-singleton queue (one toast list for the whole app) — clear
  // whatever a previous test left behind.
  beforeEach(() => {
    useToast().toasts.splice(0);
  });

  it('renders nothing when there are no toasts', () => {
    const wrapper = mount(ToastContainer, withGlobalPlugins());
    expect(wrapper.find('.toast-container').exists()).toBe(false);
  });

  it('renders a toast per pushed message, styled by variant', () => {
    useToast().push('Saved', 'success');
    useToast().push('Oops', 'error');
    const wrapper = mount(ToastContainer, withGlobalPlugins());

    const toasts = wrapper.findAll('.toast');
    expect(toasts).toHaveLength(2);
    expect(toasts[0].text()).toContain('Saved');
    expect(toasts[0].classes()).toContain('text-bg-success');
    expect(toasts[1].text()).toContain('Oops');
    expect(toasts[1].classes()).toContain('text-bg-danger');
  });

  it('dismisses a toast when its close button is clicked', async () => {
    useToast().push('Bye');
    const wrapper = mount(ToastContainer, withGlobalPlugins());

    await wrapper.find('.btn-close').trigger('click');

    expect(wrapper.findAll('.toast')).toHaveLength(0);
    expect(useToast().toasts).toHaveLength(0);
  });
});
