import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Sign-up link email. */
export function registrationEmail(
  to: string,
  activationLink: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).registration;
  return {
    to,
    subject: t.subject,
    html: t.body(activationLink),
  };
}
