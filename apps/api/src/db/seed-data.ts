// Plain data, kept free of any DB/Drizzle dependency so it can be
// unit-tested (row shapes/counts) without a live Postgres connection.

// The fixed UUID literals themselves live in packages/reference-data,
// shared with apps/web (see operations.types.ts) — re-exported here so
// existing `PAYMENT_METHOD_ID` imports from this module don't change.
import { PAYMENT_METHOD_ID } from '@bagheera/reference-data';
export { PAYMENT_METHOD_ID };

export interface PaymentMethodSeed {
  id: string;
  name: string;
  type: 'debit' | 'credit' | null;
}

// Fixed list — ids/names/types are exact.
export const paymentMethodSeeds: PaymentMethodSeed[] = [
  { id: PAYMENT_METHOD_ID.CREDIT_CARD, name: 'Credit card', type: 'debit' },
  { id: PAYMENT_METHOD_ID.CHECK_DEBIT, name: 'Check', type: 'debit' },
  {
    id: PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
    name: 'Cash withdrawal',
    type: 'debit',
  },
  { id: PAYMENT_METHOD_ID.TRANSFER_DEBIT, name: 'Transfer', type: 'debit' },
  { id: PAYMENT_METHOD_ID.CHECK_CREDIT, name: 'Check', type: 'credit' },
  { id: PAYMENT_METHOD_ID.TRANSFER_CREDIT, name: 'Transfer', type: 'credit' },
  { id: PAYMENT_METHOD_ID.DEPOSIT, name: 'Deposit', type: 'credit' },
  {
    id: PAYMENT_METHOD_ID.DIRECT_DEBIT,
    name: 'Direct debit',
    type: 'debit',
  },
  {
    id: PAYMENT_METHOD_ID.INITIAL_BALANCE,
    name: 'Initial balance',
    type: null,
  },
];

export interface CategorySeed {
  // Set only for categories referenced elsewhere by a fixed id (currently
  // just Salary, via SALARY_CATEGORY_SEED_ID — used as a stable category id
  // by tests/fixtures). Unset categories get a DB-generated UUIDv7 on
  // insert — see seed.ts's insertCategories.
  id?: string;
  name: string;
  type: 'debit' | 'credit';
  children?: CategorySeed[];
}

export const SALARY_CATEGORY_SEED_ID = '00000000-0001-7000-8000-000000000001';

// Placeholder set — real list TBD with the business owner.
export const categorySeeds: CategorySeed[] = [
  { id: SALARY_CATEGORY_SEED_ID, name: 'Salary', type: 'credit' },
  { name: 'Other income', type: 'credit' },
  {
    name: 'Housing',
    type: 'debit',
    children: [
      { name: 'Rent', type: 'debit' },
      { name: 'Utilities', type: 'debit' },
    ],
  },
  { name: 'Food', type: 'debit' },
  { name: 'Transport', type: 'debit' },
  { name: 'Leisure', type: 'debit' },
  { name: 'Health', type: 'debit' },
  { name: 'Other expense', type: 'debit' },
];
