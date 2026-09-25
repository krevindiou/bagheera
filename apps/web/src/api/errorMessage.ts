import { i18n } from '../i18n';

// Every mutating endpoint that can fail returns its error body as
// `{ message: string | string[], code?, params? }`. `message` is a single
// string for one failure, an array when class-validator collects more than
// one for the same field. Business errors also carry a stable `code` (see
// apps/api/src/common/filters/error-codes.ts): when the active locale has a
// translation for it, that is shown instead of the English `message`, which
// remains the fallback. Callers show only the first message; the fallback for
// no `message` at all (a raw 4xx/5xx with no body, or an unexpected shape) is
// the caller's job, via `errorMessage(error) ?? t("...genericError")`.
export function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const { code, params } = error as { code?: unknown; params?: Record<string, unknown> };
    if (typeof code === 'string' && i18n.global.te(`errors.${code}`)) {
      const translated = { ...params };
      if (
        typeof translated.kind === 'string' &&
        i18n.global.te(`errors.kinds.${translated.kind}`)
      ) {
        translated.kind = i18n.global.t(`errors.kinds.${translated.kind}`);
      }
      return i18n.global.t(`errors.${code}`, translated);
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
