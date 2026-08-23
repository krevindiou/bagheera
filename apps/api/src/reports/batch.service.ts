import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { report, reportAccount } from '../db/schema';
import { AuditService } from '../security/audit.service';
import '../session/session-data';

/**
 * Batch delete. Ownership is resolved per id directly against the report's
 * own `memberId` (reports have no bank/account chain): an id belonging to
 * another member, or unknown, is dropped rather than rejected — the caller
 * never learns which of its ids were foreign vs. simply didn't exist.
 */
@Injectable()
export class ReportBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
  ) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  private async filterOwned(
    ids: number[],
    memberId: number,
  ): Promise<number[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: report.id, memberId: report.memberId })
      .from(report)
      .where(inArray(report.id, ids));
    return rows.filter((row) => row.memberId === memberId).map((row) => row.id);
  }

  async batchDelete(
    req: Request,
    ids: number[],
  ): Promise<{ deletedCount: number }> {
    const memberId = this.requireMemberId(req);
    const owned = await this.filterOwned(ids, memberId);
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
