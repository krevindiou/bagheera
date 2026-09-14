import { onMounted, onUnmounted } from 'vue';

// Every drawer/modal overlay in the app mounts only while it's open (a
// parent `v-if`) — so listening for the whole time this component instance
// is alive is exactly "listen while the overlay is open". ConfirmModal is
// the one exception (always mounted, toggling its own `state.visible`
// instead) — it just guards the callback itself on that flag.
export function useEscapeKey(onEscape: () => void): void {
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onEscape();
  }
  onMounted(() => window.addEventListener('keydown', handleKeydown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
}
