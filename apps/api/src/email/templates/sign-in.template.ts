import { DEFAULT_LOCALE, type Locale } from '../../common/locale';
import { EmailMessage } from '../email-message';
import { emailCatalog } from '../i18n';

export interface SignInDetails {
  at: Date;
  /** IANA zone the time is shown in: the member's own, else the app's. */
  timeZone: string;
  /** Label of the passkey that signed in, when the member gave it one. */
  deviceName: string | null;
  sourceAddress: string;
}

/** Notice sent on every successful sign-in, so a member spots one that wasn't theirs. */
export function signInEmail(
  to: string,
  details: SignInDetails,
  locale: Locale = DEFAULT_LOCALE,
): EmailMessage {
  const t = emailCatalog(locale).signIn;
  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: details.timeZone,
  }).format(details.at);
  return {
    to,
    subject: t.subject,
    html: t.body({
      when: `${time} (${details.timeZone})`,
      passkey: details.deviceName ?? t.unnamedPasskey,
      address: details.sourceAddress,
    }),
  };
}
