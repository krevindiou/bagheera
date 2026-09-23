import { safeHtml } from '../../common/escape-html';
import { emailButton, renderEmailLayout } from '../templates/layout';

// Translation catalog for the API-sent emails. Only English (`en`) is
// enabled currently.
//
// Every body that interpolates a value is built with the safeHtml`...` tag
// (common/escape-html.ts) — it escapes every interpolation unconditionally,
// so there's no per-value decision to get wrong. `renderEmailLayout`/
// `emailButton` (../templates/layout.ts) wrap that content in the app's
// themed HTML shell.
export default {
  registration: {
    subject: 'Bagheera registration',
    body: (activationLink: string) =>
      renderEmailLayout({
        locale: 'en',
        preheader: 'Create your account and register your first passkey.',
        heading: 'Welcome to Bagheera',
        bodyHtml:
          safeHtml`<p style="margin:0 0 20px;">Click the button below to create your account and register your first passkey.</p>` +
          emailButton('Create account', activationLink),
      }),
  },
  emailChanged: {
    subject: 'Bagheera email address changed',
    body: (newAddress: string) =>
      renderEmailLayout({
        locale: 'en',
        preheader: 'Your account email address was changed.',
        heading: 'Email address changed',
        bodyHtml: safeHtml`<p style="margin:0;">The email address of your Bagheera account has just been changed to <strong style="color:#f2efe9;">${newAddress}</strong>. If you did not do this, sign in with your passkey immediately and review your account.</p>`,
      }),
  },
  confirmEmailChange: {
    subject: 'Confirm your new Bagheera email address',
    body: (confirmLink: string) =>
      renderEmailLayout({
        locale: 'en',
        preheader: 'Confirm your new email address.',
        heading: 'Confirm your new email address',
        bodyHtml:
          safeHtml`<p style="margin:0 0 20px;">A change of your Bagheera account's email address to this address was requested. Click the button below to confirm it. If you did not request this, ignore this email — your account's email address stays unchanged until this link is clicked.</p>` +
          emailButton('Confirm email address', confirmLink),
      }),
  },
  passkeyRegistered: {
    subject: 'Bagheera passkey added',
    body: renderEmailLayout({
      locale: 'en',
      preheader: 'A new passkey was added to your account.',
      heading: 'New passkey added',
      bodyHtml: safeHtml`<p style="margin:0;">A new passkey was just added to your Bagheera account. If you did not do this, sign in with one of your other passkeys immediately and remove this one from your account settings.</p>`,
    }),
  },
  passkeyRemoved: {
    subject: 'Bagheera passkey removed',
    body: renderEmailLayout({
      locale: 'en',
      preheader: 'A passkey was removed from your account.',
      heading: 'Passkey removed',
      bodyHtml: safeHtml`<p style="margin:0;">A passkey was just removed from your Bagheera account. If you did not do this, sign in with one of your remaining passkeys immediately and review the passkeys listed in your account settings.</p>`,
    }),
  },
};
