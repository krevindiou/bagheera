import { sql } from 'drizzle-orm';
import { uuid } from 'drizzle-orm/pg-core';

// Time-ordered UUIDv7 primary key, generated natively by Postgres (18+).
// Every table's surrogate PK should use this instead of `serial`.
export const uuidPk = (name = 'id') =>
  uuid(name)
    .default(sql`uuidv7()`)
    .primaryKey();
