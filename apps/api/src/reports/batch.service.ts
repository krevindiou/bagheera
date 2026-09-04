import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { report, reportAccount } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';

/**
 * Batch delete. Ownership is resolved per id via
 * OwnershipService.filterOwnedReportIds, directly against the report's own
 * `memberId` (reports have no bank/account chain): an id belonging to
 * another member, or unknown, is dropped rather than rejected — the caller
 * never learns which of its ids were foreign vs. simply didn't exist.
 */
@Injectable()
export class ReportBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async batchDelete(
    req: Request,
    ids: number[],
  ): Promise<{ deletedCount: number }> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.filterOwnedReportIds(ids, memberId);
    if (owned.length > 0) {
      await this.db.transaction(async (tx) => {
        await tx
          .delete(reportAccount)
          .where(inArray(reportAccount.reportId, owned));
        await tx.delete(report).where(inArray(report.id, owned));
      });
    }
    await this.audit.record(
      'report_batch_deleted',
      memberId,
      req.ip ?? 'unknown',
    );
    return { deletedCount: owned.length };
  }
}
