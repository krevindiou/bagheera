import 'express-session';

// Sign-in and add-a-passkey challenges, between "options" and "verify".
// Separate fields on purpose: registration options need a step-up while
// sign-in options are public, so a shared field would let a sign-in
// challenge skip the step-up. Sign-in is usernameless: the answering
// credential says who it is.
declare module 'express-session' {
  interface SessionData {
    webauthnChallenge?: string;
    registrationChallenge?: string;
  }
}
