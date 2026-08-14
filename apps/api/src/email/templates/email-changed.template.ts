import { EmailMessage } from '../email-message';

/** Notice sent to the *previous* address when a member's email changes. */
export function emailChangedEmail(
  previousAddress: string,
  newAddress: string,
): EmailMessage {
  return {
    to: previousAddress,
    subject: 'Bagheera email address changed',
    html: `The email address of your Bagheera account has just been changed to ${newAddress}. If you did not do this, use the password recovery link on the sign-in page immediately.`,
  };
}
