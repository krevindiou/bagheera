import { reactive } from 'vue';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

// Single shared queue, rendered by ToastContainer.vue.
const toasts = reactive<ToastMessage[]>([]);
let nextId = 1;

// A handful of quick saves in a row (e.g. adding several operations back to
// back) would otherwise leave every one of them on screen at once, still
// stacking by the time the container runs into other fixed UI (see
// theme.css's .toast-container comment). Capping the visible queue keeps
// the stack bounded regardless of how fast toasts arrive — the oldest is
// evicted immediately, same as if its own timer had just fired.
const MAX_VISIBLE_TOASTS = 3;

function dismiss(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

function push(text: string, variant: ToastVariant = 'info', durationMs = 5000) {
  const id = nextId++;
  toasts.push({ id, text, variant });
  while (toasts.length > MAX_VISIBLE_TOASTS) {
    toasts.shift();
  }
  setTimeout(() => dismiss(id), durationMs);
  return id;
}

export function useToast() {
  return { toasts, push, dismiss };
}
