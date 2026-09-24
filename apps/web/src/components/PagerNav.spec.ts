import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import PagerNav from './PagerNav.vue';

function mountPager(page: number, total = 45, pageSize = 20) {
  return mount(PagerNav, { ...withGlobalPlugins(), props: { page, total, pageSize } });
}

function buttons(wrapper: ReturnType<typeof mountPager>) {
  const [previous, next] = wrapper.findAll('button');
  return { previous: previous!, next: next! };
}

describe('PagerNav', () => {
  it('shows the current page out of the page count, in a labelled nav', () => {
    const wrapper = mountPager(2);

    expect(wrapper.text()).toContain('Page 2 of 3');
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Pagination');
  });

  it('counts a single page when the list is empty', () => {
    expect(mountPager(1, 0).text()).toContain('Page 1 of 1');
  });

  it('disables Previous on the first page and Next on the last', () => {
    const first = buttons(mountPager(1));
    expect(first.previous.attributes('disabled')).toBeDefined();
    expect(first.next.attributes('disabled')).toBeUndefined();

    const last = buttons(mountPager(3));
    expect(last.previous.attributes('disabled')).toBeUndefined();
    expect(last.next.attributes('disabled')).toBeDefined();
  });

  it('emits update:page with the adjacent page', async () => {
    const wrapper = mountPager(2);
    const { previous, next } = buttons(wrapper);

    await next.trigger('click');
    await previous.trigger('click');

    expect(wrapper.emitted('update:page')).toEqual([[3], [1]]);
  });

  it('emits nothing when a bounded button is clicked', async () => {
    const wrapper = mountPager(1, 10);
    const { previous, next } = buttons(wrapper);

    await previous.trigger('click');
    await next.trigger('click');

    expect(wrapper.emitted('update:page')).toBeUndefined();
  });
});
