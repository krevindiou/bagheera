import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent whenever a new passkey is registered on the account. */
export function passkeyRegisteredEmail(to: string, locale: Locale = DEFAULT_LOCALE): EmailMessage {
  const t = emailCatalog(locale).passkeyRegistered;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
