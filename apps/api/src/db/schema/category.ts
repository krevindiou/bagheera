import {
  AnyPgColumn,
  integer,
  pgTable,
  serial,
  varchar,
} from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';

// Two-level hierarchy (placeholder names — real seed list TBD with the
// business owner). The category powering the "last salary" dashboard
// indicator is picked by id via the SALARY_CATEGORY_ID config value, not
// a column on this table.
export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id').references((): AnyPgColumn => category.id),
  type: entryTypeEnum('type').notNull(),
  name: varchar('name', { length: 32 }).notNull(),
});
