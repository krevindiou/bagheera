import 'express-session';

// Global augmentation, same pattern as webauthn-session-data.ts. Stashes the
// sign-up ceremony's challenge and the raw token key between the "options"
// and "verify" round trip — separate fields from webauthnChallenge/
// webauthnMemberId so a leftover sign-in ceremony's challenge can never
// satisfy a sign-up verify, and vice versa. `pendingSignupKey` is re-parsed
// fresh at verify time (see WebauthnSignupService) — never trust a cached
// parse of it.
declare module 'express-session' {
  interface SessionData {
    pendingSignupChallenge?: string;
    pendingSignupKey?: string;
  }
}
