import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip.decorator';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { consumeStepUp } from '../session/consume-step-up';
import { requireMemberId } from '../session/require-member-id';
import { sessionEpochOf } from '../session/session-epoch';
import { SessionRegistryService, type StoredSession } from '../session/session-registry.service';
import { SESSION_IDLE_TTL_SECONDS, SESSION_MAX_AGE_MS } from '../session/session.constants';
import { SingleUseStore } from '../session/single-use-store';
import { describeUserAgent } from './describe-user-agent';
import { SessionSummaryDto } from './dto/session-summary.dto';

// The session id is the cookie's secret, so the client only ever sees a
// digest of it: enough to name a session back, useless as a cookie.
function sessionHandle(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 32);
}

/**
 * The signed-in member's own sessions: listing, and signing out the other
 * devices. Revoking consumes a step-up proof, so a stolen session can't
 * sign the owner out and keep the account to itself.
 */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly sessionRegistry: SessionRegistryService,
    private readonly singleUse: SingleUseStore,
    private readonly audit: AuditService,
  ) {}

  async list(req: Request): Promise<SessionSummaryDto[]> {
    const memberId = requireMemberId(req);
    const now = Date.now();
    const sessions = await this.liveSessionsOf(memberId, now);
    return sessions
      .map(({ id, data, ttlMs }) => {
        const current = id === req.sessionID;
        const signedInAt = data.client?.signedInAt ?? data.createdAt ?? now;
        // Every request resets the store TTL to the idle timeout, so what's
        // gone from it is the time since the session was last used.
        const lastActiveAt = current
          ? now
          : Math.max(signedInAt, now - (SESSION_IDLE_TTL_SECONDS * 1000 - ttlMs));
        return {
          id: sessionHandle(id),
          current,
          ...describeUserAgent(data.client?.userAgent),
          ipAddress: data.client?.ip ?? null,
          signedInAt: new Date(signedInAt),
          lastActiveAt: new Date(lastActiveAt),
        };
      })
      .sort(
        (a, b) =>
          Number(b.current) - Number(a.current) ||
          b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
      );
  }

  async revoke(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    await consumeStepUp(this.singleUse, req);
    // Signing out this very session is POST /auth/sign-out's job.
    const target = (await this.sessionRegistry.sessionsOf(memberId)).find(
      (session) => session.id !== req.sessionID && sessionHandle(session.id) === id,
    );
    if (!target) {
      throw new NotFoundException();
    }
    await this.sessionRegistry.revoke(memberId, target.id);
    await this.audit.record('session_revoked', memberId, clientIp(req));
  }

  async revokeOthers(req: Request): Promise<void> {
    const memberId = requireMemberId(req);
    await consumeStepUp(this.singleUse, req);
    await this.sessionRegistry.revokeOthers(memberId, req.sessionID);
    await this.audit.record('other_sessions_revoked', memberId, clientIp(req));
  }

  // Sessions a passkey removal or email change already ended (epoch), or
  // past their absolute cap, can't be used again: not worth listing.
  private async liveSessionsOf(memberId: string, now: number): Promise<StoredSession[]> {
    const [row] = await this.db
      .select({ sessionEpoch: member.sessionEpoch })
      .from(member)
      .where(eq(member.id, memberId));
    if (!row) {
      return [];
    }
    return (await this.sessionRegistry.sessionsOf(memberId)).filter(
      ({ data }) =>
        data.memberId === memberId &&
        sessionEpochOf(data) === row.sessionEpoch &&
        (data.createdAt ?? now) + SESSION_MAX_AGE_MS > now,
    );
  }
}
