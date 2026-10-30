import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import BottomBar from './BottomBar.vue';

// Shows the bar only while `show` is set, as a list does with its selection.
const Host = defineComponent({
  props: { show: { type: Boolean, default: true } },
  setup: (props) => () =>
    props.show ? h(BottomBar, { 'data-testid': 'bar' }, () => h('span', 'content')) : null,
});

describe('BottomBar', () => {
  it('puts its content in the inner row and passes attributes to the bar', () => {
    const wrapper = mount(Host);
    const bar = wrapper.get('[data-testid="bar"]');

    expect(bar.classes()).toContain('bottom-bar');
    expect(bar.get('.bottom-bar-inner').text()).toBe('content');
  });

  describe('height published for the toasts', () => {
    const height = () => document.documentElement.style.getPropertyValue('--bottom-bar-height');

    // Fires its callback on observe, as a real ResizeObserver does once.
    function stubResizeObserver() {
      const disconnect = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          callback: () => void;
          constructor(callback: () => void) {
            this.callback = callback;
          }
          observe() {
            this.callback();
          }
          disconnect = disconnect;
        },
      );
      return disconnect;
    }

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      document.documentElement.style.removeProperty('--bottom-bar-height');
    });

    it("sets the bar's height while it shows, and clears it once it goes away", async () => {
      const disconnect = stubResizeObserver();
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(57);
      const wrapper = mount(Host);
      await flushPromises();

      expect(height()).toBe('57px');

      await wrapper.setProps({ show: false });
      expect(height()).toBe('');
      expect(disconnect).toHaveBeenCalled();
    });

    it('clears the height when the page unmounts with the bar still showing', async () => {
      stubResizeObserver();
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(57);
      const wrapper = mount(Host);
      await flushPromises();

      wrapper.unmount();
      expect(height()).toBe('');
    });
  });
});
