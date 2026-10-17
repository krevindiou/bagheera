import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    const toasts = wrapper.findAll('.toast-item');
    expect(toasts).toHaveLength(2);
    expect(toasts[0].text()).toContain('Saved');
    expect(toasts[0].classes()).toContain('toast-success');
    expect(toasts[1].text()).toContain('Oops');
    expect(toasts[1].classes()).toContain('toast-error');
  });

  it('drops a shown error toast once a success toast arrives', async () => {
    useToast().push('Too many requests', 'error');
    const wrapper = mount(ToastContainer, withGlobalPlugins());

    useToast().push('Account saved', 'success');
    await wrapper.vm.$nextTick();

    const toasts = wrapper.findAll('.toast-item');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text()).toContain('Account saved');
  });

  it('dismisses a toast when its close button is clicked', async () => {
    useToast().push('Bye');
    const wrapper = mount(ToastContainer, withGlobalPlugins());

    await wrapper.find('.toast-close').trigger('click');

    expect(wrapper.findAll('.toast-item')).toHaveLength(0);
    expect(useToast().toasts).toHaveLength(0);
  });

  it('labels the dismiss button "Close", not "Cancel"', () => {
    useToast().push('Bye');
    const wrapper = mount(ToastContainer, withGlobalPlugins());

    expect(wrapper.find('.toast-close').attributes('aria-label')).toBe('Close');
  });

  describe('auto-dismiss timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('dismisses a success toast after its duration', async () => {
      useToast().push('Saved', 'success');
      const wrapper = mount(ToastContainer, withGlobalPlugins());

      await vi.advanceTimersByTimeAsync(5000);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast-item')).toHaveLength(0);
    });

    it('never auto-dismisses an error toast', async () => {
      useToast().push('Transfer account currency mismatch.', 'error');
      const wrapper = mount(ToastContainer, withGlobalPlugins());

      await vi.advanceTimersByTimeAsync(60_000);
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.toast-item')).toHaveLength(1);
    });

    it('pauses dismissal while hovered and resumes once the pointer leaves', async () => {
      useToast().push('Saved', 'success');
      const wrapper = mount(ToastContainer, withGlobalPlugins());
      const toast = wrapper.find('.toast-item');

      await vi.advanceTimersByTimeAsync(4000);
      await toast.trigger('mouseenter');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(wrapper.findAll('.toast-item')).toHaveLength(1);

      await toast.trigger('mouseleave');
      await vi.advanceTimersByTimeAsync(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('.toast-item')).toHaveLength(0);
    });

    it('pauses dismissal while focus is within and resumes once it leaves', async () => {
      useToast().push('Saved', 'success');
      const wrapper = mount(ToastContainer, withGlobalPlugins());
      const toast = wrapper.find('.toast-item');

      await vi.advanceTimersByTimeAsync(4000);
      await toast.trigger('focusin');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(wrapper.findAll('.toast-item')).toHaveLength(1);

      await toast.trigger('focusout');
      await vi.advanceTimersByTimeAsync(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('.toast-item')).toHaveLength(0);
    });
  });
});
