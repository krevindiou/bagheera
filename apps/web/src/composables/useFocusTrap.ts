import { onMounted, onUnmounted, type Ref } from 'vue';

// What Tab can land on (disabled and tabindex="-1" skipped).
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps Tab focus inside `container` while the caller is mounted, as an
 * `aria-modal` dialog promises: wrapping at both ends, and pulling escaped
 * focus back in. On unmount, focus returns to what held it before, if still
 * on the page.
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
