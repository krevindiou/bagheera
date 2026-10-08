import { eq, gte, lte, SQL, inArray } from 'drizzle-orm';
import { ilikeContains } from '../common/like-pattern';
import { operation, report } from '../db/schema';

// Operation filters shared by every report aggregation, scoped to
// `accountIds`.
export function reportOperationConditions(
  rpt: Pick<
    typeof report.$inferSelect,
    'valueDateStart' | 'valueDateEnd' | 'thirdParties' | 'reconciledOnly'
  >,
  accountIds: string[],
  // Empty = no category filter.
  categoryIds: string[] = [],
): SQL[] {
  const conditions: SQL[] = [inArray(operation.accountId, accountIds)];
  if (rpt.valueDateStart) {
    conditions.push(gte(operation.valueDate, rpt.valueDateStart));
  }
  if (rpt.valueDateEnd) {
    conditions.push(lte(operation.valueDate, rpt.valueDateEnd));
  }
  if (rpt.thirdParties) {
    conditions.push(ilikeContains(operation.thirdParty, rpt.thirdParties));
  }
  if (rpt.reconciledOnly) {
    conditions.push(eq(operation.reconciled, true));
  }
  if (categoryIds.length > 0) {
    conditions.push(inArray(operation.categoryId, categoryIds));
  }
  return conditions;
}
