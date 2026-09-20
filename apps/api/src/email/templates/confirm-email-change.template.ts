import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Confirmation link sent to the *new* address requested via a profile
 * email change — the change only takes effect once this is clicked. */
export function confirmEmailChangeEmail(
  to: string,
  confirmLink: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).confirmEmailChange;
  return {
    to,
    subject: t.subject,
    html: t.body(confirmLink),
  };
}
