import { pgEnum } from 'drizzle-orm/pg-core';

// Shared debit/credit typing used by PaymentMethod, Category, Operation and
// Scheduler.
export const entryTypeEnum = pgEnum('entry_type', ['debit', 'credit']);
