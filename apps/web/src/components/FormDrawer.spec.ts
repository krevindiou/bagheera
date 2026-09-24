import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import FormDrawer from './FormDrawer.vue';

// The drawer's Escape and focus-trap listeners live on `window`, so a
// drawer left mounted by one test would still react to the next test's
// key presses — tracked here and torn down after each test instead.
const mounted = new Set<VueWrapper>();

function mountDrawer(
  options: { subtitle?: string; attrs?: Record<string, unknown>; attachTo?: Element } = {},
) {
  const { subtitle, attrs, attachTo } = options;
  const wrapper = mount(FormDrawer, {
    ...withGlobalPlugins(),
    ...(attachTo ? { attachTo } : {}),
    props: { title: 'Edit bank', subtitle },
    attrs,
    slots: {
      default: '<input id="field" />',
      actions: '<button type="submit" class="btn btn-primary">Save</button>',
    },
  });
  mounted.add(wrapper);
  return wrapper;
}

describe('FormDrawer', () => {
  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount());
    mounted.clear();
    document.body.innerHTML = '';
  });

  it('renders a modal dialog labelled by its title', () => {
    const wrapper = mountDrawer();
    const dialog = wrapper.find('[role="dialog"]');
    const title = wrapper.find('h2');

    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(title.text()).toBe('Edit bank');
    expect(dialog.attributes('aria-labelledby')).toBe(title.attributes('id'));
    expect(dialog.attributes('aria-describedby')).toBeUndefined();
    expect(wrapper.find('.drawer-header .form-text').exists()).toBe(false);
  });

  it('renders the subtitle under the title as the dialog description', () => {
    const wrapper = mountDrawer({ subtitle: 'Totals per period' });
    const subtitle = wrapper.find('.drawer-header .form-text');

    expect(subtitle.text()).toBe('Totals per period');
    expect(wrapper.find('[role="dialog"]').attributes('aria-describedby')).toBe(
      subtitle.attributes('id'),
    );
  });

  it('puts attributes on the form rather than the backdrop', () => {
    const wrapper = mountDrawer({ attrs: { novalidate: '', 'data-testid': 'some-form' } });

    const form = wrapper.find('form');
    expect(form.attributes('novalidate')).toBeDefined();
    expect(form.attributes('data-testid')).toBe('some-form');
    expect(wrapper.find('.drawer-backdrop').attributes('data-testid')).toBeUndefined();
  });

  it('renders the fields, then the actions row, then Cancel, all inside the form', () => {
    const wrapper = mountDrawer();
    const form = wrapper.find('form');

    expect(form.find('#field').exists()).toBe(true);
    expect(form.find('.drawer-actions button.btn-primary').exists()).toBe(true);
    expect(form.findAll('button').map((button) => button.text())).toEqual(['Save', 'Cancel']);
  });

  it('emits submit with the native submit default-prevented', () => {
    const wrapper = mountDrawer();
    const event = new Event('submit', { cancelable: true });

    wrapper.find('form').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('emits close from the backdrop, the × button and the Cancel button', async () => {
    const wrapper = mountDrawer();

    await wrapper.find('.drawer-backdrop').trigger('click');
    await wrapper.find('.drawer-close').trigger('click');
    await wrapper.find('form button.btn-outline-secondary').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('emits close when Escape is pressed', () => {
    const wrapper = mountDrawer();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('does not close on a click inside the panel', async () => {
    const wrapper = mountDrawer();

    await wrapper.find('.drawer').trigger('click');
    await wrapper.find('#field').trigger('click');

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('keeps Tab focus inside the panel, wrapping from Cancel to the × button', () => {
    const wrapper = mountDrawer({ attachTo: document.body });
    (wrapper.find('form button.btn-outline-secondary').element as HTMLElement).focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));

    expect(document.activeElement).toBe(wrapper.find('.drawer-close').element);
  });

  it('hands focus back to the element that opened it once closed', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const wrapper = mountDrawer({ attachTo: document.body });
    (wrapper.find('#field').element as HTMLElement).focus();

    mounted.delete(wrapper);
    wrapper.unmount();

    expect(document.activeElement).toBe(opener);
  });
});
