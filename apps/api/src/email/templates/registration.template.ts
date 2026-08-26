import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Registration/activation-resend email. */
export function registrationEmail(
  to: string,
  activationLink: string,
): EmailMessage {
  const t = emailCatalog().registration;
  return {
    to,
    subject: t.subject,
    html: t.body(activationLink),
  };
}
