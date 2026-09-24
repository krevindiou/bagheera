import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import MenuPopover from './MenuPopover.vue';

// The dismiss listeners live on `document`/`window`, so hosts are torn down
// after each test.
const mounted = new Set<VueWrapper>();

function mountPopover(props: { open?: boolean; panelClass?: string } = {}) {
  const wrapper = mount(MenuPopover, {
    attachTo: document.body,
    attrs: { class: 'consumer-root' },
    props,
    slots: {
      trigger: `<template #trigger="{ open, toggle }">
        <button class="trigger" :aria-expanded="open" @click="toggle">menu</button>
      </template>`,
      default: '<p class="content">panel body</p>',
    },
  });
  mounted.add(wrapper);
  return wrapper;
}

describe('MenuPopover', () => {
  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount());
    mounted.clear();
  });

  it('starts closed, with the consumer class on its root', () => {
    const wrapper = mountPopover();

    expect(wrapper.classes()).toContain('consumer-root');
    expect(wrapper.find('.menu-panel').exists()).toBe(false);
    expect(wrapper.get('.trigger').attributes('aria-expanded')).toBe('false');
  });

  it('toggles the panel from the trigger slot, adding the placement class', async () => {
    const wrapper = mountPopover({ panelClass: 'placement' });
    const trigger = wrapper.get('.trigger');

    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.menu-panel').classes()).toContain('placement');
    expect(wrapper.get('.menu-panel .content').text()).toBe('panel body');

    await trigger.trigger('click');
    expect(wrapper.find('.menu-panel').exists()).toBe(false);
  });

  it('closes on Escape and reports it through update:open', async () => {
    const wrapper = mountPopover();
    await wrapper.get('.trigger').trigger('click');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.menu-panel').exists()).toBe(false);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('closes on an outside click but not on a click inside the panel', async () => {
    const wrapper = mountPopover();
    await wrapper.get('.trigger').trigger('click');

    wrapper.get('.content').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.menu-panel').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.menu-panel').exists()).toBe(false);
  });
});
