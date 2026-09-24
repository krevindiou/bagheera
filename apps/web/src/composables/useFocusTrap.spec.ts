import { defineComponent, h, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useFocusTrap } from './useFocusTrap';

// Every trap listens on `window`, so a host left mounted by one test would
// keep intercepting the next test's Tab presses — tracked here and torn
// down after each test instead.
const mounted = new Set<VueWrapper>();

// A container with three tabbable buttons, bracketed by a tabindex="-1"
// element and a disabled button the trap must not count as its first/last
// stop. `bind: false` leaves the container ref unbound; `empty: true`
// renders the container with nothing tabbable in it.
function mountHost(options: { bind?: boolean; empty?: boolean } = {}) {
  const { bind = true, empty = false } = options;
  const Host = defineComponent({
    setup() {
      const container = ref<HTMLElement | null>(null);
      useFocusTrap(container);
      return () =>
        h(
          'div',
          bind ? { ref: container } : {},
          empty
            ? [h('p', 'nothing to focus')]
            : [
                h('span', { tabindex: '-1' }, 'skipped'),
                h('button', { id: 'first' }, 'first'),
                h('button', { id: 'middle' }, 'middle'),
                h('button', { id: 'last' }, 'last'),
                h('button', { disabled: true }, 'skipped'),
              ],
        );
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  mounted.add(wrapper);
  return wrapper;
}

function unmountHost(wrapper: VueWrapper) {
  mounted.delete(wrapper);
  wrapper.unmount();
}

// A focusable element outside any trap's container.
function outsideButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.appendChild(button);
  return button;
}

function pressTab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function byId(id: string): HTMLElement {
  return document.getElementById(id)!;
}

describe('useFocusTrap', () => {
  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount());
    mounted.clear();
    document.body.innerHTML = '';
  });

  it('wraps Tab from the last tabbable element back to the first', () => {
    mountHost();
    byId('last').focus();

    const event = pressTab();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('first'));
  });

  it('wraps Shift+Tab from the first tabbable element back to the last', () => {
    mountHost();
    byId('first').focus();

    const event = pressTab(true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('last'));
  });

  it('leaves Tab between inner elements to the browser', () => {
    mountHost();
    byId('middle').focus();

    expect(pressTab().defaultPrevented).toBe(false);
    expect(pressTab(true).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('middle'));
  });

  it('pulls focus back inside when Tab is pressed from outside the container', () => {
    mountHost();
    const outside = outsideButton();

    outside.focus();
    pressTab();
    expect(document.activeElement).toBe(byId('first'));

    outside.focus();
    pressTab(true);
    expect(document.activeElement).toBe(byId('last'));
  });

  it('ignores every key other than Tab', () => {
    mountHost();
    byId('last').focus();

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('last'));
  });

  it('does nothing while its container ref is unbound', () => {
    mountHost({ bind: false });
    const outside = outsideButton();
    outside.focus();

    expect(pressTab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it('does nothing when the container holds nothing tabbable', () => {
    mountHost({ empty: true });
    const outside = outsideButton();
    outside.focus();

    expect(pressTab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it('stops trapping once unmounted', () => {
    unmountHost(mountHost());
    const outside = outsideButton();
    outside.focus();

    expect(pressTab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it('hands focus back to whatever held it before mounting, once unmounted', () => {
    const opener = outsideButton();
    opener.focus();
    const wrapper = mountHost();
    byId('middle').focus();

    unmountHost(wrapper);

    expect(document.activeElement).toBe(opener);
  });

  it('skips that hand-back when the previously focused element has left the page', () => {
    const opener = outsideButton();
    opener.focus();
    const wrapper = mountHost();
    byId('middle').focus();
    opener.remove();

    unmountHost(wrapper);

    expect(document.activeElement).not.toBe(opener);
  });
});
