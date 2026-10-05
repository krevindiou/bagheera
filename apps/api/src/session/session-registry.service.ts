import { Inject, Injectable } from '@nestjs/common';
import type IORedis from 'ioredis';
import { SESSION_KEY_PREFIX, SESSION_MAX_AGE_MS, VALKEY_CLIENT } from './session.constants';

const MEMBER_SESSIONS_TTL_SECONDS = SESSION_MAX_AGE_MS / 1000;

function memberSessionsKey(memberId: string): string {
  return `member:${memberId}:sessions`;
}

/**
 * Tracks which session ids belong to a member (a Valkey set per member), so
 * a security-relevant change — removing a passkey, confirming a new email
 * address — can sign out every other device instead of leaving a stolen
 * session alive until its 24h absolute cap.
 *
 * Ids of sessions that ended on their own (idle timeout, sign-out) stay in
 * the set until the next revocation or until the set itself expires; both
 * are harmless, since deleting a missing session key is a no-op. The set's
 * TTL is the absolute session cap, refreshed on every sign-in: no session
 * it lists can outlive it.
 */
@Injectable()
export class SessionRegistryService {
  constructor(@Inject(VALKEY_CLIENT) private readonly valkey: IORedis) {}

  async register(memberId: string, sessionId: string): Promise<void> {
    const key = memberSessionsKey(memberId);
    await this.valkey.multi().sadd(key, sessionId).expire(key, MEMBER_SESSIONS_TTL_SECONDS).exec();
  }

  async unregister(memberId: string, sessionId: string): Promise<void> {
    await this.valkey.srem(memberSessionsKey(memberId), sessionId);
  }

  /** Destroys every session of the member except `keepSessionId` (none, if omitted). */
  async revokeOthers(memberId: string, keepSessionId?: string): Promise<void> {
    const key = memberSessionsKey(memberId);
    const others = (await this.valkey.smembers(key)).filter((id) => id !== keepSessionId);
    if (others.length === 0) {
      return;
    }
    await this.valkey
      .multi()
      .del(...others.map((id) => `${SESSION_KEY_PREFIX}${id}`))
      .srem(key, ...others)
      .exec();
  }
}
