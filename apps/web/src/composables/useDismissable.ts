import { onMounted, onUnmounted, type Ref } from 'vue';
import { useEscapeKey } from './useEscapeKey';

// Closes a popover (`open` -> false) on Escape or a click outside `root`.
// The popovers using this are always mounted (the app shell), so the
// listeners live for the app's whole lifetime — the callbacks guard on
// `open` rather than mounting/unmounting, same as ConfirmModal.
export function useDismissable(open: Ref<boolean>, root: Ref<HTMLElement | null>): void {
  useEscapeKey(() => {
    if (open.value) open.value = false;
  });

  function onDocumentClick(event: MouseEvent): void {
    if (open.value && root.value && !root.value.contains(event.target as Node)) {
      open.value = false;
    }
  }
  onMounted(() => document.addEventListener('click', onDocumentClick));
  onUnmounted(() => document.removeEventListener('click', onDocumentClick));
}
