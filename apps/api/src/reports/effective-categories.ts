import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { reportCategory } from '../db/schema';

// Data = the report's linked category ids, or an empty array when none are
// linked — an empty array means "no category filter" to reportOperationConditions,
// not "match nothing". Unlike effectiveAccounts, there's no ownership chain
// to fall back through: categories are fixed reference data, not member-owned.
export async function effectiveCategoryIds(
  db: NodePgDatabase,
  reportId: string,
): Promise<string[]> {
  const rows = await db
    .select({ categoryId: reportCategory.categoryId })
    .from(reportCategory)
    .where(eq(reportCategory.reportId, reportId));
  return rows.map((row) => row.categoryId);
}
