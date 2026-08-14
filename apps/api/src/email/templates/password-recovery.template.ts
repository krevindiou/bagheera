import { EmailMessage } from '../email-message';

/** Forgot-password email. */
export function passwordRecoveryEmail(
  to: string,
  changePasswordLink: string,
): EmailMessage {
  return {
    to,
    subject: 'Bagheera change password',
    html: `Click on the following link to change your password: <a href="${changePasswordLink}">${changePasswordLink}</a>`,
  };
}
