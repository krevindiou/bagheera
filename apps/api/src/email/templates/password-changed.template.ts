import { EmailMessage } from '../email-message';

/** Notice sent whenever the password changes, via either flow. */
export function passwordChangedEmail(to: string): EmailMessage {
  return {
    to,
    subject: 'Bagheera password changed',
    html: 'Your Bagheera password has just been changed. If you did not do this, use the password recovery link on the sign-in page immediately.',
  };
}
