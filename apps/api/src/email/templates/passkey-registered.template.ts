import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent whenever a new passkey is registered on the account. */
export function passkeyRegisteredEmail(to: string): EmailMessage {
  const t = emailCatalog().passkeyRegistered;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
