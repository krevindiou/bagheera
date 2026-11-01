/**
 * The form an address is counted under: lower-cased like the email lookups
 * (find-member-by-email.ts), and trimmed, for callers that see it before
 * validation.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The mailbox a plus-tagged address delivers to (`inbox+tag@x` → `inbox@x`),
 * or `undefined` when the local part carries no tag. Only for counting: mail
 * still goes to the address as typed.
 */
export function plusTaggedMailbox(email: string): string | undefined {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  const plus = normalized.indexOf('+');
  if (plus < 0 || at < 0 || plus > at) {
    return undefined;
  }
  return normalized.slice(0, plus) + normalized.slice(at);
}
