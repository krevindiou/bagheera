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

// Quick saves in a row would otherwise stack toasts into other fixed UI;
// past the cap, the oldest goes at once.
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
