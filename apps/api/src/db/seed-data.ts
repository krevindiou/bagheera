// Plain data, kept free of any DB/Drizzle dependency so it can be
// unit-tested (row shapes/counts) without a live Postgres connection.

export interface PaymentMethodSeed {
  id: number;
  name: string;
  type: 'debit' | 'credit' | null;
}

// Fixed list — ids/names/types are exact.
export const paymentMethodSeeds: PaymentMethodSeed[] = [
  { id: 1, name: 'Credit card', type: 'debit' },
  { id: 2, name: 'Check', type: 'debit' },
  { id: 3, name: 'Cash withdrawal', type: 'debit' },
  { id: 4, name: 'Transfer', type: 'debit' },
  { id: 5, name: 'Check', type: 'credit' },
  { id: 6, name: 'Transfer', type: 'credit' },
  { id: 7, name: 'Deposit', type: 'credit' },
  { id: 8, name: 'Direct debit', type: 'debit' },
  { id: 9, name: 'Initial balance', type: null },
];

export interface CategorySeed {
  name: string;
  type: 'debit' | 'credit';
  children?: CategorySeed[];
}

// Placeholder set — real list TBD with the business owner. "Salary" is
// seeded first so it gets id 1, matching the SALARY_CATEGORY_ID config
// default (see dashboard.service.ts).
export const categorySeeds: CategorySeed[] = [
  { name: 'Salary', type: 'credit' },
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
