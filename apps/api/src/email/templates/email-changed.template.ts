import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent to the *previous* address when a member's email changes. */
export function emailChangedEmail(
  previousAddress: string,
  newAddress: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).emailChanged;
  return {
    to: previousAddress,
    subject: t.subject,
    html: t.body(newAddress),
  };
}
