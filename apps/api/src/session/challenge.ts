import type { Session, SessionData } from 'express-session';

/**
 * How long a WebAuthn challenge stays answerable after its options were
 * issued. Browsers abandon the prompt after about a minute (the options'
 * own `timeout`), so a challenge older than this belongs to a ceremony the
 * member cancelled or walked away from — never one still in progress.
 */
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;

/** The session fields that hold a pending ceremony's challenge. */
export type ChallengeKey =
  'webauthnChallenge' | 'registrationChallenge' | 'stepUpChallenge' | 'pendingSignupChallenge';

declare module 'express-session' {
  interface SessionData {
    webauthnChallengeIssuedAt?: number;
    registrationChallengeIssuedAt?: number;
    stepUpChallengeIssuedAt?: number;
    pendingSignupChallengeIssuedAt?: number;
  }
}

type ChallengeSession = Session & Partial<SessionData>;

/** Stashes a challenge with its issue time — always through this, so none is ever stored undated. */
export function storeChallenge(
  session: ChallengeSession,
  key: ChallengeKey,
  challenge: string,
): void {
  session[key] = challenge;
  session[`${key}IssuedAt`] = Date.now();
}

/**
 * Reads and clears a pending challenge: single-use, whatever the outcome.
 * Undefined when absent, undated, or older than CHALLENGE_TTL_MS, so an
 * abandoned ceremony doesn't leave one answerable for the whole session.
 */
export function takeChallenge(session: ChallengeSession, key: ChallengeKey): string | undefined {
  const challenge = session[key];
  const issuedAt = session[`${key}IssuedAt`];
  delete session[key];
  delete session[`${key}IssuedAt`];
  if (!challenge || issuedAt === undefined || Date.now() - issuedAt > CHALLENGE_TTL_MS) {
    return undefined;
  }
  return challenge;
}
