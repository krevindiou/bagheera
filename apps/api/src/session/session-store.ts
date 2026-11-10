import { RedisStore } from 'connect-redis';
import type { SessionData } from 'express-session';
import type IORedis from 'ioredis';
import { holdsOnlyCookie } from './is-new-session';
import './session-data';
import {
  ANONYMOUS_SESSION_MAX_AGE_MS,
  SESSION_IDLE_TTL_SECONDS,
  SESSION_KEY_PREFIX,
  SESSION_MAX_AGE_MS,
} from './session.constants';
import { sessionStoreClient } from './session-store-client';

/** How long after `createdAt` a session is force-expired. */
export function sessionMaxAgeMs(session: Partial<SessionData>): number {
  return session.memberId ? SESSION_MAX_AGE_MS : ANONYMOUS_SESSION_MAX_AGE_MS;
}

/**
 * The store TTL set on every write and refresh: the idle timeout, cut down
 * for an anonymous session to what's left of its absolute cap, so no
 * refresh can keep its key past that. A signed-in session's 8h cap is
 * enforced on its next request instead (absoluteSessionTtl).
 */
export function sessionTtlSeconds(session: Partial<SessionData>, now = Date.now()): number {
  if (session.memberId) {
    return SESSION_IDLE_TTL_SECONDS;
  }
  const remainingMs = (session.createdAt ?? now) + ANONYMOUS_SESSION_MAX_AGE_MS - now;
  // Rounded down, so the key never outlives the cap; 0 or less deletes it.
  return Math.min(SESSION_IDLE_TTL_SECONDS, Math.floor(remainingMs / 1000));
}

type SetCallback = Parameters<RedisStore['set']>[2];

/**
 * connect-redis's store, with each session's TTL from sessionTtlSeconds and
 * `createdAt` stamped when it's first stored — not on its next request,
 * which would leave a just-minted anonymous session's clock unstarted.
 */
export class SessionStore extends RedisStore {
  constructor(client: IORedis) {
    super({
      client: sessionStoreClient(client),
      prefix: SESSION_KEY_PREFIX,
      ttl: (session) => sessionTtlSeconds(session),
    });
  }

  override set(sid: string, session: SessionData, cb?: SetCallback): ReturnType<RedisStore['set']> {
    // express-session saves a regenerated session even when nothing was
    // written to it; keeping one would hand out a fresh anonymous session
    // past the CSRF mint's rate limit.
    if (holdsOnlyCookie(session)) {
      return this.destroy(sid, cb);
    }
    session.createdAt ??= Date.now();
    return super.set(sid, session, cb);
  }
}
