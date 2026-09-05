import 'express-session';

// Global augmentation, same pattern as session-data.ts / the absolute-TTL
// middleware's. Both registration and authentication ceremonies stash their
// challenge here between the "options" and "verify" round trip.
//
// `webauthnMemberId` is only meaningful during the authentication ceremony,
// where the caller isn't signed in yet: it's set when `options` resolved a
// real member with at least one credential, and left unset for an unknown
// email or one with no credentials — see webauthn-authentication.service.ts
// for why that's the anti-enumeration branch, not an error.
declare module 'express-session' {
  interface SessionData {
    webauthnChallenge?: string;
    webauthnMemberId?: number;
  }
}
