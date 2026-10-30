import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import PagerNav from './PagerNav.vue';

function mountPager(page: number, total = 45, pageSize = 20) {
  return mount(PagerNav, { ...withGlobalPlugins(), props: { page, total, pageSize } });
}

function buttons(wrapper: ReturnType<typeof mountPager>) {
  const all = wrapper.findAll('button');
  return { previous: all[0], next: all[all.length - 1] };
}

// The numbered buttons, by their visible number.
function pageButtons(wrapper: ReturnType<typeof mountPager>) {
  return wrapper.findAll('button.pager-page').map((button) => ({ number: button.text(), button }));
}

describe('PagerNav', () => {
  it('shows the current page out of the page count, in a labelled nav', () => {
    const wrapper = mountPager(2);

    expect(wrapper.text()).toContain('Page 2 of 3');
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Pagination');
  });

  it('leads with the status, then Previous, the page numbers and Next', () => {
    const nav = mountPager(2).get('nav').element;

    expect(nav.firstElementChild?.textContent).toBe('Page 2 of 3');
    expect(
      [...nav.lastElementChild!.querySelectorAll('button')].map((b) => b.textContent?.trim()),
    ).toEqual(['Previous', '1', '2', '3', 'Next']);
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

  it('shows every page number while they fit, the current one marked', () => {
    const wrapper = mountPager(2, 45);

    expect(pageButtons(wrapper).map((p) => p.number)).toEqual(['1', '2', '3']);
    const current = wrapper.findAll('button[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].text()).toBe('2');
    expect(wrapper.find('.pager-gap').exists()).toBe(false);
  });

  it('collapses far pages behind a gap and keeps two pages on each side of the current one', () => {
    const wrapper = mountPager(7, 260);

    expect(wrapper.text()).toContain('Page 7 of 13');
    expect(pageButtons(wrapper).map((p) => p.number)).toEqual(['1', '5', '6', '7', '8', '9', '13']);
    expect(wrapper.findAll('.pager-gap')).toHaveLength(2);
  });

  it('jumps straight to a numbered page', async () => {
    const wrapper = mountPager(7, 260);

    await pageButtons(wrapper)
      .find((p) => p.number === '5')!
      .button.trigger('click');
    await pageButtons(wrapper)
      .find((p) => p.number === '13')!
      .button.trigger('click');

    expect(wrapper.emitted('update:page')).toEqual([[5], [13]]);
  });

  it('labels each number for assistive tech', () => {
    const wrapper = mountPager(7, 260);

    expect(pageButtons(wrapper)[1].button.attributes('aria-label')).toBe('Go to page 5');
  });

  it('emits nothing when the current page is clicked', async () => {
    const wrapper = mountPager(2);

    await pageButtons(wrapper)
      .find((p) => p.number === '2')!
      .button.trigger('click');

    expect(wrapper.emitted('update:page')).toBeUndefined();
  });

  describe('keeping the buttons under the cursor', () => {
    // The nav's on-screen top, which the test moves to stand in for the
    // new page being taller or shorter than the last.
    function mountAt(top: { value: number }) {
      const wrapper = mount(PagerNav, {
        ...withGlobalPlugins(),
        props: { page: 1, total: 100, pageSize: 20 },
        attachTo: document.body,
      });
      vi.spyOn(wrapper.get('nav').element, 'getBoundingClientRect').mockImplementation(
        () => ({ top: top.value }) as DOMRect,
      );
      return wrapper;
    }

    it('scrolls by how far the pager moved once the requested page lands', async () => {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      const top = { value: 800 };
      const wrapper = mountAt(top);

      await buttons(wrapper).next.trigger('click');
      top.value = 856;
      await wrapper.setProps({ page: 2 });

      expect(scrollBy).toHaveBeenCalledWith({ top: 56, behavior: 'instant' });
      scrollBy.mockRestore();
      wrapper.unmount();
    });

    it('also follows a jump to a numbered page', async () => {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      const top = { value: 800 };
      const wrapper = mountAt(top);

      await pageButtons(wrapper)
        .find((p) => p.number === '4')!
        .button.trigger('click');
      top.value = 790;
      await wrapper.setProps({ page: 4 });

      expect(scrollBy).toHaveBeenCalledWith({ top: -10, behavior: 'instant' });
      scrollBy.mockRestore();
      wrapper.unmount();
    });

    it('leaves the scroll alone when the pager did not move', async () => {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      const wrapper = mountAt({ value: 800 });

      await buttons(wrapper).next.trigger('click');
      await wrapper.setProps({ page: 2 });

      expect(scrollBy).not.toHaveBeenCalled();
      scrollBy.mockRestore();
      wrapper.unmount();
    });

    it('ignores a page change the pager did not ask for', async () => {
      const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
      const top = { value: 800 };
      const wrapper = mountAt(top);

      await buttons(wrapper).next.trigger('click');
      top.value = 900;
      await wrapper.setProps({ page: 4 });

      expect(scrollBy).not.toHaveBeenCalled();
      scrollBy.mockRestore();
      wrapper.unmount();
    });
  });
});
