import { defineComponent, h, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useDismissable } from './useDismissable';

// Listeners live on `document`/`window`, so a host left mounted by one test
// would keep reacting in the next — torn down after each test instead.
const mounted = new Set<VueWrapper>();

function mountHost(initiallyOpen = true) {
  const open = ref(initiallyOpen);
  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      useDismissable(open, root);
      return () =>
        h('div', [
          h('div', { ref: root, id: 'inside' }, [h('button', { id: 'inner' }, 'inner')]),
          h('button', { id: 'outside' }, 'outside'),
        ]);
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  mounted.add(wrapper);
  return { wrapper, open };
}

describe('useDismissable', () => {
  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount());
    mounted.clear();
  });

  it('closes on Escape', () => {
    const { open } = mountHost();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(open.value).toBe(false);
  });

  it('closes on a click outside the root', () => {
    const { wrapper, open } = mountHost();

    wrapper.get('#outside').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(open.value).toBe(false);
  });

  it('stays open on a click inside the root', () => {
    const { wrapper, open } = mountHost();

    wrapper.get('#inner').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(open.value).toBe(true);
  });

  it('leaves a closed popover closed', () => {
    const { wrapper, open } = mountHost(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    wrapper.get('#outside').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(open.value).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const { wrapper, open } = mountHost();
    wrapper.unmount();
    mounted.delete(wrapper);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(open.value).toBe(true);
  });
});
