import 'express-session';

// Global augmentation, same pattern as webauthn-session-data.ts /
// signup-session-data.ts. Stashes the step-up ceremony's challenge and the
// member it was issued for between the "options" and "verify" round trip;
// `stepUpVerifiedAt` is the single-use proof `ProfileService.updateEmail`
// consumes in place of a current-password check — see
// WebauthnStepUpService for the full ceremony and its TTL.
declare module 'express-session' {
  interface SessionData {
    stepUpChallenge?: string;
    stepUpMemberId?: string;
    stepUpVerifiedAt?: number;
  }
}
