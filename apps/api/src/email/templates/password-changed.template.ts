import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

/** Notice sent whenever the password changes, via either flow. */
export function passwordChangedEmail(to: string, locale: Locale = DEFAULT_LOCALE): EmailMessage {
  const t = emailCatalog(locale).passwordChanged;
  return {
    to,
    subject: t.subject,
    html: t.body,
  };
}
