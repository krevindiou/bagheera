import { safeHtml } from '../../common/escape-html';

// Translation catalog for the API-sent emails. Only English (`en`) is
// enabled currently.
//
// Every body that interpolates a value is built with the safeHtml`...` tag
// (common/escape-html.ts) — it escapes every interpolation unconditionally,
// so there's no per-value decision to get wrong. A body with nothing to
// interpolate (passwordChanged) stays a plain string.
export default {
  registration: {
    subject: 'Bagheera registration',
    body: (activationLink: string) =>
      safeHtml`Welcome to Bagheera, — Click on the following link to activate your account: <a href="${activationLink}">${activationLink}</a>`,
  },
  passwordRecovery: {
    subject: 'Bagheera change password',
    body: (changePasswordLink: string) =>
      safeHtml`Click on the following link to change your password: <a href="${changePasswordLink}">${changePasswordLink}</a>`,
  },
  passwordChanged: {
    subject: 'Bagheera password changed',
    body: 'Your Bagheera password has just been changed. If you did not do this, use the password recovery link on the sign-in page immediately.',
  },
  emailChanged: {
    subject: 'Bagheera email address changed',
    body: (newAddress: string) =>
      safeHtml`The email address of your Bagheera account has just been changed to ${newAddress}. If you did not do this, use the password recovery link on the sign-in page immediately.`,
  },
  passkeyRegistered: {
    subject: 'Bagheera passkey added',
    body: 'A new passkey was just added to your Bagheera account, letting it sign in without your password. If you did not do this, change your password immediately from the sign-in page and remove the passkey from your account settings.',
  },
};
