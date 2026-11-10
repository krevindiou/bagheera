import 'express-session';

/** The browser a member signed in from, listed on their sessions page. */
export interface SessionClient {
  userAgent: string | null;
  /** Source address at sign-in; later requests may come from another. */
  ip: string;
  /** Latest source address outside the one `ip` (or the previous one) belongs to. */
  lastIp?: string;
  signedInAt: number;
}

// The signed-in member, set on sign-in and sign-up completion.
declare module 'express-session' {
  interface SessionData {
    memberId?: string;
    // The member's `sessionEpoch` this session signed in under. Missing on
    // sessions that predate it, which counts as 0.
    sessionEpoch?: number;
    // Forces session persistence (see CsrfTokenController).
    csrfIssued?: boolean;
    // When the session was first stored (see SessionStore), the start of its
    // absolute cap.
    createdAt?: number;
    // Set with memberId (see recordSessionClient).
    client?: SessionClient;
  }
}
