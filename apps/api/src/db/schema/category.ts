import {
  AnyPgColumn,
  boolean,
  integer,
  pgTable,
  serial,
  varchar,
} from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';

// Two-level hierarchy. isSalaryCategory flags the single category powering
// the "last salary" dashboard indicator (placeholder names — real seed list
// TBD with the business owner).
export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id').references((): AnyPgColumn => category.id),
  type: entryTypeEnum('type').notNull(),
  name: varchar('name', { length: 32 }).notNull(),
  isSalaryCategory: boolean('is_salary_category').notNull().default(false),
});
