import type { Session, SessionData } from 'express-session';

/**
 * How long a WebAuthn challenge stays answerable after its options were
 * issued. Browsers abandon the prompt after about a minute (the options'
 * own `timeout`), so a challenge older than this belongs to a ceremony the
 * member cancelled or walked away from — never one still in progress.
 */
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;

/** The session fields that hold a pending ceremony's challenge. */
export type ChallengeKey = 'webauthnChallenge' | 'registrationChallenge' | 'stepUpChallenge';

declare module 'express-session' {
  interface SessionData {
    webauthnChallengeIssuedAt?: number;
    registrationChallengeIssuedAt?: number;
    stepUpChallengeIssuedAt?: number;
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
 * Reads and clears a pending challenge — single-use, whatever the outcome.
 * Returns undefined when there is none or it has outlived CHALLENGE_TTL_MS
 * (without this, a ceremony abandoned halfway — e.g. a cancelled
 * "add a passkey" prompt, whose step-up proof is already spent — leaves a
 * challenge anyone holding the session cookie could answer for the rest of
 * the session). A challenge stored without a timestamp counts as expired.
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
