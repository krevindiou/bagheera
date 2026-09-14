import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { useEscapeKey } from './useEscapeKey';

function mountHost(onEscape: () => void) {
  const Host = defineComponent({
    setup() {
      useEscapeKey(onEscape);
      return () => h('div');
    },
  });
  return mount(Host);
}

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('useEscapeKey', () => {
  it('calls the callback when Escape is pressed while mounted', () => {
    const onEscape = vi.fn();
    mountHost(onEscape);

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores every other key', () => {
    const onEscape = vi.fn();
    mountHost(onEscape);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const onEscape = vi.fn();
    const wrapper = mountHost(onEscape);
    wrapper.unmount();

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});
