import 'express-session';

// Global augmentation, same pattern as session-data.ts / the absolute-TTL
// middleware's. The sign-in (`webauthnChallenge`) and add-a-passkey
// (`registrationChallenge`) ceremonies each stash their challenge between
// the "options" and "verify" round trip — in separate fields on purpose:
// registration options are gated behind a step-up (see
// WebauthnRegistrationService) while sign-in options are public, so a
// shared field would let a signed-in caller seed a registration verify()
// with a challenge from the ungated sign-in endpoint and skip the step-up.
// Sign-in stashes nothing else: it's usernameless, so who's signing in is
// only known from the credential that answers (see
// webauthn-authentication.service.ts).
declare module 'express-session' {
  interface SessionData {
    webauthnChallenge?: string;
    registrationChallenge?: string;
  }
}
