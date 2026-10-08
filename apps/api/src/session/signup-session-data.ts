import 'express-session';

// The sign-up ceremony's challenge and raw token key, between "options" and
// "verify". Separate from webauthnChallenge so a sign-in challenge can't
// satisfy a sign-up verify, and vice versa. `pendingSignupKey` is re-parsed
// at verify time, never trusted as cached.
declare module 'express-session' {
  interface SessionData {
    pendingSignupChallenge?: string;
    pendingSignupKey?: string;
  }
}
