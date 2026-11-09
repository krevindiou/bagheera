import type { Request } from 'express';
import type { SingleUseSlots, SingleUseStore } from './single-use-store';

/**
 * How long a WebAuthn challenge stays answerable after its options were
 * issued. Browsers abandon the prompt after about a minute (the options'
 * own `timeout`), so a challenge older than this belongs to a ceremony the
 * member cancelled or walked away from — never one still in progress.
 */
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;

/** The slots that hold a pending ceremony's challenge. */
export type ChallengeKey =
  | 'webauthnChallenge'
  | 'registrationChallenge'
  | 'stepUpChallenge'
  | 'pendingSignupChallenge';

/** Stashes a challenge — always through this, so none outlives CHALLENGE_TTL_MS. */
export function storeChallenge<K extends ChallengeKey>(
  store: SingleUseStore,
  req: Request,
  key: K,
  data: SingleUseSlots[K],
): Promise<void> {
  return store.put(req, key, data, CHALLENGE_TTL_MS);
}

/**
 * Takes a pending challenge: single-use, whatever the outcome, and even when
 * concurrent requests race for it. Undefined when absent or expired, so an
 * abandoned ceremony doesn't leave one answerable for the whole session.
 */
export function takeChallenge<K extends ChallengeKey>(
  store: SingleUseStore,
  req: Request,
  key: K,
): Promise<SingleUseSlots[K] | undefined> {
  return store.take(req, key);
}
