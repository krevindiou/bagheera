import { eq, gte, lte, SQL, inArray } from 'drizzle-orm';
import { ilikeContains } from '../common/like-pattern';
import { operation, report } from '../db/schema';

// The operation-level filters shared by every report aggregation (date
// range, third-party text search, reconciled-only) — scoped to the given
// account ids. Callers `and(...)` this with any grouping/join-specific
// conditions of their own.
export function reportOperationConditions(
  rpt: Pick<
    typeof report.$inferSelect,
    'valueDateStart' | 'valueDateEnd' | 'thirdParties' | 'reconciledOnly'
  >,
  accountIds: string[],
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
  return conditions;
}
