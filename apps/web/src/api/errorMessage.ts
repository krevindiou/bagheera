import { i18n } from '../i18n';

// Error bodies are `{ category, message: string | string[], code?, params? }`.
// A translated `code` (the API's BusinessError) wins over the English
// `message`; otherwise the first message, except for an uncoded
// validation_error, whose message is raw DTO text naming internal fields.
// No usable message is the caller's to handle:
// `errorMessage(error) ?? t("...genericError")`.
export function errorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const { code, params, category } = error as {
    code?: unknown;
    params?: Record<string, unknown>;
    category?: unknown;
  };
  if (typeof code === 'string' && i18n.global.te(`errors.${code}`)) {
    const translated = { ...params };
    if (typeof translated.kind === 'string' && i18n.global.te(`errors.kinds.${translated.kind}`)) {
      translated.kind = i18n.global.t(`errors.kinds.${translated.kind}`);
    }
    return i18n.global.t(`errors.${code}`, translated);
  }
  if (category === 'validation_error') return undefined;
  if ('message' in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
