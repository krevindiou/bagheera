import type { Directive } from 'vue';

// A drop-in replacement for the native `autofocus` HTML attribute. Native
// autofocus always scrolls the focused element into view, even when it's
// already fully visible — inside a fixed-position drawer, that still nudges
// the *page's own* scroll position, visibly shifting the content behind the
// backdrop by a few pixels the instant the drawer opens.
// `{ preventScroll: true }` focuses the field without that jump.
export const vAutofocus: Directive<HTMLElement, boolean | undefined> = {
  mounted(el, binding) {
    if (binding.value === false) return;
    el.focus({ preventScroll: true });
  },
};
