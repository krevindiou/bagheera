import { Inject, Injectable } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { VALKEY_CLIENT } from './session.constants';
import './session-data';

interface StoredSessionData {
  memberId?: number;
}

/**
 * Server-side session termination — required because sessions here are
 * tracked server-side, not just a self-contained client credential.
 */
@Injectable()
export class SessionTerminationService {
  constructor(
    @Inject(VALKEY_CLIENT) private readonly valkeyClient: RedisClientType,
  ) {}

  /**
   * Deletes every stored session belonging to `memberId` other than
   * `exceptSessionId` — used after sign-in-affecting mutations (password
   * change/recovery) that must terminate a member's other active sessions
   * while leaving the current one intact.
   */
  /**
   * Deletes every stored session belonging to `memberId` — used by the
   * unauthenticated password-recovery flow, which has no "current
   * session" to except.
   */
  async terminateAllSessions(memberId: number): Promise<void> {
    await this.terminateOtherSessions(memberId, null);
  }

  async terminateOtherSessions(
    memberId: number,
    exceptSessionId: string | null,
  ): Promise<void> {
    const exceptKey = exceptSessionId ? `sess:${exceptSessionId}` : null;
    for await (const batch of this.valkeyClient.scanIterator({
      MATCH: 'sess:*',
    })) {
      const keys = Array.isArray(batch) ? batch : [batch];
      for (const key of keys) {
        if (key === exceptKey) {
          continue;
        }
        const raw = await this.valkeyClient.get(key);
        if (!raw) {
          continue;
        }
        let data: StoredSessionData;
        try {
          data = JSON.parse(raw) as StoredSessionData;
        } catch {
          continue;
        }
        if (data.memberId === memberId) {
          await this.valkeyClient.del(key);
        }
      }
    }
  }
}
