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

const DEFAULT_DURATION_MS = 5000;

// An error needs to stay put until the member reads and dismisses it
// (WCAG 2.2.1 Timing Adjustable); success/info can vanish on their own.
const AUTO_DISMISS_VARIANTS: ReadonlySet<ToastVariant> = new Set(['success', 'info']);

interface TimerState {
  handle: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
}

const timers = new Map<number, TimerState>();

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer?.handle !== null && timer?.handle !== undefined) clearTimeout(timer.handle);
  timers.delete(id);
}

function dismiss(id: number) {
  clearTimer(id);
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

function armTimer(id: number, ms: number) {
  const handle = setTimeout(() => dismiss(id), ms);
  timers.set(id, { handle, remainingMs: ms, startedAt: Date.now() });
}

function push(text: string, variant: ToastVariant = 'info', durationMs = DEFAULT_DURATION_MS) {
  const id = nextId++;
  toasts.push({ id, text, variant });
  while (toasts.length > MAX_VISIBLE_TOASTS) {
    const evicted = toasts.shift();
    if (evicted) clearTimer(evicted.id);
  }
  if (AUTO_DISMISS_VARIANTS.has(variant)) armTimer(id, durationMs);
  return id;
}

// Hovering or focusing a toast (e.g. to select its text, or tab to the
// close button) pauses its timer so it can't disappear mid-read.
function pause(id: number) {
  const timer = timers.get(id);
  if (!timer || timer.handle === null) return;
  clearTimeout(timer.handle);
  timer.remainingMs = Math.max(timer.remainingMs - (Date.now() - timer.startedAt), 0);
  timer.handle = null;
}

// Resumes with whatever time was left, so a brief hover doesn't reset a
// long-running countdown back to the top.
function resume(id: number) {
  const timer = timers.get(id);
  if (!timer || timer.handle !== null) return;
  timer.startedAt = Date.now();
  timer.handle = setTimeout(() => dismiss(id), timer.remainingMs);
}

export function useToast() {
  return { toasts, push, dismiss, pause, resume };
}
