import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Sent instead of a sign-up link when someone registers an address that already has an account. */
export function accountExistsEmail(
  to: string,
  signInLink: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).accountExists;
  return {
    to,
    subject: t.subject,
    html: t.body(signInLink),
  };
}
