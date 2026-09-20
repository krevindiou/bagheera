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
      safeHtml`Welcome to Bagheera — click on the following link to create your account and register your first passkey: <a href="${activationLink}">${activationLink}</a>`,
  },
  emailChanged: {
    subject: 'Bagheera email address changed',
    body: (newAddress: string) =>
      safeHtml`The email address of your Bagheera account has just been changed to ${newAddress}. If you did not do this, sign in with your passkey immediately and review your account.`,
  },
  confirmEmailChange: {
    subject: 'Confirm your new Bagheera email address',
    body: (confirmLink: string) =>
      safeHtml`A change of your Bagheera account's email address to this address was requested. Click on the following link to confirm it: <a href="${confirmLink}">${confirmLink}</a>. If you did not request this, ignore this email — your account's email address stays unchanged until this link is clicked.`,
  },
  passkeyRegistered: {
    subject: 'Bagheera passkey added',
    body: 'A new passkey was just added to your Bagheera account. If you did not do this, sign in with one of your other passkeys immediately and remove this one from your account settings.',
  },
};
