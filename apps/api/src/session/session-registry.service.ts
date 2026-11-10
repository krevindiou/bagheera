import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SessionData } from 'express-session';
import type IORedis from 'ioredis';
import { errorMessage } from '../common/error-message';
import { SESSION_KEY_PREFIX, SESSION_MAX_AGE_MS, VALKEY_CLIENT } from './session.constants';

const MEMBER_SESSIONS_TTL_SECONDS = SESSION_MAX_AGE_MS / 1000;

export interface StoredSession {
  id: string;
  data: Partial<SessionData>;
  /** What's left of its idle timeout, in milliseconds. */
  ttlMs: number;
}

function parseSession(raw: string): Partial<SessionData> | null {
  try {
    return JSON.parse(raw) as Partial<SessionData>;
  } catch {
    return null;
  }
}

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
 *
 * SessionAuthGuard also requires the session's id to be listed here, so a
 * revoked session that an in-flight request writes back stays signed out.
 * The member's session epoch (see session-epoch.ts) is what ends sessions
 * for good; revoking here frees them from the store sooner.
 */
@Injectable()
export class SessionRegistryService {
  private readonly logger = new Logger(SessionRegistryService.name);

  constructor(@Inject(VALKEY_CLIENT) private readonly valkey: IORedis) {}

  async register(memberId: string, sessionId: string): Promise<void> {
    const key = memberSessionsKey(memberId);
    await this.valkey.multi().sadd(key, sessionId).expire(key, MEMBER_SESSIONS_TTL_SECONDS).exec();
  }

  async unregister(memberId: string, sessionId: string): Promise<void> {
    await this.valkey.srem(memberSessionsKey(memberId), sessionId);
  }

  async isRegistered(memberId: string, sessionId: string): Promise<boolean> {
    return (await this.valkey.sismember(memberSessionsKey(memberId), sessionId)) === 1;
  }

  /** The member's listed sessions still in the store; ended ones are skipped. */
  async sessionsOf(memberId: string): Promise<StoredSession[]> {
    const ids = await this.valkey.smembers(memberSessionsKey(memberId));
    if (ids.length === 0) {
      return [];
    }
    const pipeline = this.valkey.pipeline();
    for (const id of ids) {
      pipeline.get(`${SESSION_KEY_PREFIX}${id}`).pttl(`${SESSION_KEY_PREFIX}${id}`);
    }
    const replies = (await pipeline.exec()) ?? [];
    return ids.flatMap((id, index) => {
      const [getErr, raw] = replies[2 * index] ?? [];
      const [ttlErr, ttlMs] = replies[2 * index + 1] ?? [];
      if (getErr || ttlErr || typeof raw !== 'string' || typeof ttlMs !== 'number') {
        return [];
      }
      const data = parseSession(raw);
      return data ? [{ id, data, ttlMs }] : [];
    });
  }

  /** Destroys one session of the member. */
  async revoke(memberId: string, sessionId: string): Promise<void> {
    await this.valkey
      .multi()
      .del(`${SESSION_KEY_PREFIX}${sessionId}`)
      .srem(memberSessionsKey(memberId), sessionId)
      .exec();
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

  /**
   * `revokeOthers` after a committed session epoch bump, which already ended
   * those sessions: a Valkey failure here is logged, never thrown.
   */
  async tryRevokeOthers(memberId: string, keepSessionId?: string): Promise<void> {
    try {
      await this.revokeOthers(memberId, keepSessionId);
    } catch (err) {
      this.logger.warn(`Other sessions not removed from the store: ${errorMessage(err)}`);
    }
  }
}
