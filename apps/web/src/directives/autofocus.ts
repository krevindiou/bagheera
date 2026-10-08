import type { Directive } from 'vue';

// Native `autofocus` without the scroll: inside a fixed drawer, native
// autofocus nudges the page behind the backdrop.
export const vAutofocus: Directive<HTMLElement, boolean | undefined> = {
  mounted(el, binding) {
    if (binding.value === false) return;
    el.focus({ preventScroll: true });
  },
};
