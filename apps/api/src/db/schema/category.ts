import { AnyPgColumn, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';
import { uuidPk } from './id';

// Two-level hierarchy (placeholder names — real seed list TBD with the
// business owner).
export const category = pgTable('category', {
  id: uuidPk(),
  parentId: uuid('parent_id').references((): AnyPgColumn => category.id),
  type: entryTypeEnum('type').notNull(),
  name: varchar('name', { length: 32 }).notNull(),
});
