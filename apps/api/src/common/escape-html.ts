const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes HTML-significant characters so a value can be safely interpolated
 * into an HTML string (e.g. an email template body). Values interpolated
 * into `email/i18n/*.ts` template bodies are constrained today (server-built
 * links, `@IsEmail()`-validated addresses), but templates are hand-built
 * strings with no auto-escaping, so any user-influenced value must be run
 * through this first.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
