import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent whenever the password changes, via either flow. */
export function passwordChangedEmail(to: string): EmailMessage {
  const t = emailCatalog().passwordChanged;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
