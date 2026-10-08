import 'express-session';

// The signed-in member, set on sign-in and sign-up completion.
declare module 'express-session' {
  interface SessionData {
    memberId?: string;
    // Forces session persistence (see CsrfTokenController).
    csrfIssued?: boolean;
  }
}
