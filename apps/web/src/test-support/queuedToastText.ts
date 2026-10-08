import { useToast } from '../composables/useToast';

/**
 * Every queued toast's text, joined: toasts render in BaseLayout, not in a
 * page mounted alone.
 */
export function queuedToastText(): string {
  return useToast()
    .toasts.map((toast) => toast.text)
    .join('\n');
}
