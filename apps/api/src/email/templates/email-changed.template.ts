import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent to the *previous* address when a member's email changes. */
export function emailChangedEmail(
  previousAddress: string,
  newAddress: string,
): EmailMessage {
  const t = emailCatalog().emailChanged;
  return {
    to: previousAddress,
    subject: t.subject,
    html: t.body(newAddress),
  };
}
