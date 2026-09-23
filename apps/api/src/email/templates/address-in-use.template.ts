import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Sent, instead of a confirmation link, to the owner of an address another member asked to switch to. */
export function addressInUseEmail(to: string, locale: Locale = DEFAULT_LOCALE): EmailMessage {
  const t = emailCatalog(locale).addressInUse;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
