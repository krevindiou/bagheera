import { reactive } from "vue";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

// Single shared queue, rendered by ToastContainer.vue.
const toasts = reactive<ToastMessage[]>([]);
let nextId = 1;

function dismiss(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

function push(text: string, variant: ToastVariant = "info", durationMs = 5000) {
  const id = nextId++;
  toasts.push({ id, text, variant });
  setTimeout(() => dismiss(id), durationMs);
  return id;
}

export function useToast() {
  return { toasts, push, dismiss };
}
