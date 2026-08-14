import { EmailMessage } from '../email-message';

/** Registration/activation-resend email. */
export function registrationEmail(
  to: string,
  activationLink: string,
): EmailMessage {
  return {
    to,
    subject: 'Bagheera registration',
    html: `Welcome to Bagheera, — Click on the following link to activate your account: <a href="${activationLink}">${activationLink}</a>`,
  };
}
