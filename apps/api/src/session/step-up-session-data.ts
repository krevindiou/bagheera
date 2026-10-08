import 'express-session';

// The step-up ceremony's challenge and member, between "options" and
// "verify"; `stepUpVerifiedAt` is the single-use proof consumeStepUp()
// checks.
declare module 'express-session' {
  interface SessionData {
    stepUpChallenge?: string;
    stepUpMemberId?: string;
    stepUpVerifiedAt?: number;
  }
}
