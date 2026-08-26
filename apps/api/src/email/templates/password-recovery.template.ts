import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Forgot-password email. */
export function passwordRecoveryEmail(
  to: string,
  changePasswordLink: string,
): EmailMessage {
  const t = emailCatalog().passwordRecovery;
  return {
    to,
    subject: t.subject,
    html: t.body(changePasswordLink),
  };
}
