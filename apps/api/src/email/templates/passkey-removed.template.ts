import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent whenever a passkey is removed from the account. */
export function passkeyRemovedEmail(to: string, locale: Locale = DEFAULT_LOCALE): EmailMessage {
  const t = emailCatalog(locale).passkeyRemoved;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
