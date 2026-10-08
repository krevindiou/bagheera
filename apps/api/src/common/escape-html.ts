const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * The only supported way to build an interpolated HTML template (e.g. an
 * email body): every value is escaped unconditionally, with no opt-out for
 * "already safe" ones.
 *
 * Not named `html`: Prettier would format that tag's contents as embedded
 * HTML, inserting line breaks into the email body.
 *
 * Not lint-enforced: a plain template literal stays possible, caught by
 * review.
 */
export function safeHtml(strings: TemplateStringsArray, ...values: string[]): string {
  return strings.reduce(
    (result, part, i) => result + part + (i < values.length ? escapeHtml(values[i]) : ''),
    '',
  );
}
