import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type IORedis from 'ioredis';
import { SINGLE_USE_KEY_PREFIX, VALKEY_CLIENT } from './session.constants';

/**
 * What each slot holds. One slot per ceremony on purpose: registration
 * options need a step-up while sign-in options are public, so a shared slot
 * would let a sign-in challenge skip the step-up, and a sign-in challenge
 * must never satisfy a sign-up verify. Sign-in is usernameless: the
 * answering credential says who it is.
 */
export interface SingleUseSlots {
  webauthnChallenge: { challenge: string };
  registrationChallenge: { challenge: string };
  stepUpChallenge: { challenge: string; memberId: string };
  // `signupKey` is re-parsed at verify time, never trusted as cached.
  pendingSignupChallenge: { challenge: string; signupKey: string };
  stepUpProof: { memberId: string };
}

export type SingleUseSlot = keyof SingleUseSlots;

type Stored<S extends SingleUseSlot> = SingleUseSlots[S] & { expiresAt: number };

export function singleUseKey(sessionId: string, slot: SingleUseSlot): string {
  return `${SINGLE_USE_KEY_PREFIX}${sessionId}:${slot}`;
}

/**
 * A session's single-use state: pending ceremony challenges and the step-up
 * proof. Kept out of the session itself, which express-session writes back
 * whole when a response ends: overlapping requests would each spend the same
 * value, and a stale write could bring a spent one back. Here each value is
 * a Valkey key of its own, taken with GETDEL, so exactly one request gets it.
 *
 * Keyed by session id: rotation and sign-out leave the previous id's values
 * unreachable, and their TTL removes them.
 */
@Injectable()
export class SingleUseStore {
  constructor(@Inject(VALKEY_CLIENT) private readonly valkey: IORedis) {}

  /** Replaces the slot's value, answerable for `ttlMs`. */
  async put<S extends SingleUseSlot>(
    req: Request,
    slot: S,
    data: SingleUseSlots[S],
    ttlMs: number,
  ): Promise<void> {
    const stored: Stored<S> = { ...data, expiresAt: Date.now() + ttlMs };
    await this.valkey.set(singleUseKey(req.sessionID, slot), JSON.stringify(stored), 'PX', ttlMs);
  }

  /**
   * Takes the slot's value: gone afterwards, whatever the caller does with
   * it. Undefined when absent or past its expiry.
   */
  async take<S extends SingleUseSlot>(
    req: Request,
    slot: S,
  ): Promise<SingleUseSlots[S] | undefined> {
    const raw = await this.valkey.getdel(singleUseKey(req.sessionID, slot));
    if (!raw) {
      return undefined;
    }
    // The deadline decides, on the API's clock like every other session
    // timestamp; the key's TTL only bounds how long an unspent value lingers.
    const { expiresAt, ...data } = JSON.parse(raw) as Stored<S>;
    if (Date.now() > expiresAt) {
      return undefined;
    }
    return data as unknown as SingleUseSlots[S];
  }
}
