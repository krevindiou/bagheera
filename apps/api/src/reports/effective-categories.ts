import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { reportCategory } from '../db/schema';

// The report's linked category ids; empty means no category filter.
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
