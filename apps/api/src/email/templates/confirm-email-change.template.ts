import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Confirmation link sent to the *new* address requested via a profile
 * email change — the change only takes effect once this is clicked. */
export function confirmEmailChangeEmail(
  to: string,
  confirmLink: string,
): EmailMessage {
  const t = emailCatalog().confirmEmailChange;
  return {
    to,
    subject: t.subject,
    html: t.body(confirmLink),
  };
}
