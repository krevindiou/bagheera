const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes HTML-significant characters so a value can be safely interpolated
 * into an HTML string.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * The only supported way to build an interpolated HTML template in this
 * codebase (e.g. an email body) — every interpolated value is escaped
 * unconditionally, so a template literal built by hand (and therefore
 * possibly unescaped) never has to exist. Values that are already "safe"
 * (a server-built, `encodeURIComponent`-ed link, say) are escaped too:
 * escaping a safe value is a no-op on the output, and an opt-out would just
 * reintroduce the "is this one fine?" judgment call this exists to remove.
 *
 * Deliberately NOT named `html` — Prettier auto-detects that tag name and
 * reformats the template's contents as embedded HTML, inserting real
 * line-break characters into the string, which would corrupt the sent email
 * body. See prettier's embeddedLanguageFormatting.
 *
 * Unlike ilikeContains (see common/like-pattern.ts), this isn't lint-enforced
 * — there's no single banned identifier to flag; a plain untagged template
 * literal in email/i18n/*.ts stays possible, caught by review, not the build.
 */
export function safeHtml(
  strings: TemplateStringsArray,
  ...values: string[]
): string {
  return strings.reduce(
    (result, part, i) =>
      result + part + (i < values.length ? escapeHtml(values[i]) : ''),
    '',
  );
}
