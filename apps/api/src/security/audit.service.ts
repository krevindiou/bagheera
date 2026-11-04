import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { errorMessage } from '../common/error-message';
import { DRIZZLE } from '../db/db.constants';
import type { Executor } from '../db/executor';
import { securityEvent } from '../db/schema';
import { securityEventTypeEnum } from '../db/schema/enums';

export type SecurityEventType = (typeof securityEventTypeEnum.enumValues)[number];

// Identifiers and counts only: never a secret or the content of a file.
export type SecurityEventDetails = Record<string, string | number>;

async function insertEvent(
  executor: Executor | NodePgDatabase,
  eventType: SecurityEventType,
  memberId: string | null,
  sourceAddress: string,
  details?: SecurityEventDetails,
): Promise<void> {
  await executor.insert(securityEvent).values({
    eventType,
    memberId: memberId ?? undefined,
    sourceAddress,
    details,
  });
}

/**
 * Writes to the security event log — the audit trail behind incident
 * investigation and abuse detection. Additive by design: callers record
 * events alongside their normal flow and a failure here must never change
 * the caller's outcome, so writes are best-effort (logged, not thrown).
 * `recordIn` is the exception, for a change that must not commit unrecorded.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async record(
    eventType: SecurityEventType,
    memberId: string | null,
    sourceAddress: string,
    details?: SecurityEventDetails,
  ): Promise<void> {
    try {
      await insertEvent(this.db, eventType, memberId, sourceAddress, details);
    } catch (err) {
      this.logger.error(`Failed to record security event "${eventType}": ${errorMessage(err)}`);
    }
  }

  /**
   * Writes the event through `tx`, so it commits or rolls back with the
   * change it records. Throws: a failure swallowed inside a transaction
   * would leave it aborted and the change silently rolled back.
   */
  async recordIn(
    tx: Executor,
    eventType: SecurityEventType,
    memberId: string | null,
    sourceAddress: string,
    details?: SecurityEventDetails,
  ): Promise<void> {
    await insertEvent(tx, eventType, memberId, sourceAddress, details);
  }
}
