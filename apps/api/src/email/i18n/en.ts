import { escapeHtml } from '../../common/escape-html';

// Translation catalog for the API-sent emails. Only English (`en`) is
// enabled currently.
//
// Every value interpolated into a body below MUST go through escapeHtml()
// first — these are hand-built HTML strings with no auto-escaping.
export default {
  registration: {
    subject: 'Bagheera registration',
    body: (activationLink: string) => {
      const link = escapeHtml(activationLink);
      return `Welcome to Bagheera, — Click on the following link to activate your account: <a href="${link}">${link}</a>`;
    },
  },
  passwordRecovery: {
    subject: 'Bagheera change password',
    body: (changePasswordLink: string) => {
      const link = escapeHtml(changePasswordLink);
      return `Click on the following link to change your password: <a href="${link}">${link}</a>`;
    },
  },
  passwordChanged: {
    subject: 'Bagheera password changed',
    body: 'Your Bagheera password has just been changed. If you did not do this, use the password recovery link on the sign-in page immediately.',
  },
  emailChanged: {
    subject: 'Bagheera email address changed',
    body: (newAddress: string) =>
      `The email address of your Bagheera account has just been changed to ${escapeHtml(newAddress)}. If you did not do this, use the password recovery link on the sign-in page immediately.`,
  },
};
