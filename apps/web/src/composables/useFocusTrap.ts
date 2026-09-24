import { onMounted, onUnmounted, type Ref } from 'vue';

// Everything a Tab press can land on — disabled controls and
// tabindex="-1" elements are skipped, same as the browser's own
// sequential navigation skips them.
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps keyboard focus inside `container` for as long as the calling
 * component is mounted — what an `aria-modal="true"` dialog promises
 * assistive tech (everything outside it is out of reach). Tab past the
 * last tabbable element wraps to the first, Shift+Tab before the first
 * wraps to the last, and a Tab pressed while focus has escaped the
 * container (e.g. onto <body> after a click on blank space) pulls it back
 * in. On unmount, focus goes back to whatever held it before the
 * container opened — typically the button that opened it — if that
 * element is still on the page.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>): void {
  // Captured during setup, not onMounted: by the time the caller's own
  // mounted hook runs, a child's v-autofocus has already moved focus into
  // the container.
  const previouslyFocused = document.activeElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !container.value) return;
    const tabbable = container.value.querySelectorAll<HTMLElement>(TABBABLE);
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (!first || !last) return;

    const active = document.activeElement;
    const inside = active !== null && container.value.contains(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown));
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus({ preventScroll: true });
    }
  });
}
