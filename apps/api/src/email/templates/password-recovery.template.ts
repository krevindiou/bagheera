import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Forgot-password email. */
export function passwordRecoveryEmail(
  to: string,
  changePasswordLink: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).passwordRecovery;
  return {
    to,
    subject: t.subject,
    html: t.body(changePasswordLink),
  };
}
