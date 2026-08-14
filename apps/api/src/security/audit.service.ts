import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { securityEvent } from '../db/schema';

export type SecurityEventType =
  | 'sign_in_success'
  | 'sign_in_failure'
  | 'sign_in_throttled'
  | 'password_recovery_requested'
  | 'password_recovery_completed'
  | 'password_changed'
  | 'email_changed'
  | 'activation_issued'
  | 'activation_used'
  | 'operation_batch_deleted'
  | 'operation_batch_reconciled';

/**
 * Writes to the security event log — the audit trail behind incident
 * investigation and abuse detection. Additive by design: callers record
 * events alongside their normal flow and a failure here must never change
 * the caller's outcome, so writes are best-effort (logged, not thrown).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async record(
    eventType: SecurityEventType,
    memberId: number | null,
    sourceAddress: string,
  ): Promise<void> {
    try {
      await this.db.insert(securityEvent).values({
        eventType,
        memberId: memberId ?? undefined,
        sourceAddress,
      });
    } catch (err) {
      this.logger.error(
        `Failed to record security event "${eventType}": ${(err as Error).message}`,
      );
    }
  }
}
