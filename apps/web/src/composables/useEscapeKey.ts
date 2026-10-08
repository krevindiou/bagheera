import { onMounted, onUnmounted } from 'vue';

// Listens while the calling component is mounted: overlays mount only
// while open, except always-mounted ones (ConfirmModal, popovers) that
// guard the callback on their own flag.
export function useEscapeKey(onEscape: () => void): void {
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onEscape();
  }
  onMounted(() => window.addEventListener('keydown', handleKeydown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
}
