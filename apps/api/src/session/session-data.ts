import 'express-session';

// Global augmentation: the authenticated member id carried by the session,
// set on sign-in (see auth/sign-in.*) and read wherever a request needs to
// know who's signed in.
declare module 'express-session' {
  interface SessionData {
    memberId?: number;
  }
}
