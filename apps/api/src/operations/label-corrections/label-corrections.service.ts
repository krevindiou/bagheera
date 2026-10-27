import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { DRIZZLE } from '../../db/db.constants';
import { labelCorrection } from '../../db/schema';
import { AuditService } from '../../security/audit.service';
import { MemberId } from '../../security/ids';
import { LabelCorrectionListDto } from './label-corrections.dto';

/**
 * A Member's remembered label corrections. They are created by an
 * import (ImportService); here they are only listed and deleted. Every query
 * is scoped to the Member, so another Member's id is treated as unknown.
 */
@Injectable()
export class LabelCorrectionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
  ) {}

  async list(memberId: MemberId): Promise<LabelCorrectionListDto> {
    const items = await this.db
      .select({
        id: labelCorrection.id,
        sourceLabel: labelCorrection.sourceLabel,
        thirdParty: labelCorrection.thirdParty,
      })
      .from(labelCorrection)
      .where(eq(labelCorrection.memberId, memberId))
      .orderBy(asc(sql`lower(${labelCorrection.sourceLabel})`), asc(labelCorrection.id));
    return { items, limit: IMPORT_LIMITS.MAX_LABEL_CORRECTIONS };
  }

  // Unknown, foreign and already deleted ids are dropped silently, as in the
  // other batch actions. Nothing is audited when none is deleted.
  async delete(memberId: MemberId, ip: string, ids: string[]): Promise<{ deletedCount: number }> {
    const deleted = await this.db
      .delete(labelCorrection)
      .where(and(eq(labelCorrection.memberId, memberId), inArray(labelCorrection.id, ids)))
      .returning({ id: labelCorrection.id });
    if (deleted.length > 0) {
      await this.audit.record('label_corrections_deleted', memberId, ip);
    }
    return { deletedCount: deleted.length };
  }
}
