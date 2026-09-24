import { useToast } from '../composables/useToast';

/**
 * Every queued toast's text, joined — what a spec substring-matches
 * against instead of a page's own rendered text. Toasts render once, in
 * BaseLayout's ToastContainer, not inside any page a spec mounts alone.
 */
export function queuedToastText(): string {
  return useToast()
    .toasts.map((toast) => toast.text)
    .join('\n');
}
