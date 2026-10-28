// Plain data, free of any DB dependency so it unit-tests without Postgres.
import { PAYMENT_METHOD_ID, type EntryType } from '@bagheera/reference-data';
export { PAYMENT_METHOD_ID };

export interface PaymentMethodSeed {
  id: string;
  name: string;
  type: EntryType | null;
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
  name: string;
  type: EntryType;
  children?: CategorySeed[];
}

// Names are the stored English labels; the web translates them by slug
// (apps/web/src/i18n/locales/*.ts, `referenceData`). A rename orphans the
// rows already seeded under the old name, so only add to this list.
const leaf = (name: string, type: EntryType): CategorySeed => ({ name, type });

const group = (name: string, type: EntryType, children: string[] = []): CategorySeed => ({
  name,
  type,
  ...(children.length ? { children: children.map((child) => leaf(child, type)) } : {}),
});

export const categorySeeds: CategorySeed[] = [
  group('Salary', 'credit'),
  group('Bonus', 'credit'),
  group('Self-employment income', 'credit'),
  group('Benefits', 'credit', ['Family', 'Unemployment', 'Pension']),
  group('Investment income', 'credit', ['Interest', 'Dividends', 'Capital gains']),
  group('Rental income', 'credit'),
  group('Refunds', 'credit', ['Tax refund', 'Health reimbursement', 'Purchase refund']),
  group('Gifts received', 'credit'),
  group('Resale', 'credit'),
  group('Other income', 'credit'),

  group('Housing', 'debit', [
    'Rent',
    'Mortgage',
    'Condo fees',
    'Utilities',
    'Home maintenance',
    'Furniture and appliances',
  ]),
  group('Telecom', 'debit', ['Internet', 'Mobile phone']),
  group('Food', 'debit', [
    'Groceries',
    'Restaurants',
    'Takeaway and delivery',
    'Coffee and snacks',
  ]),
  group('Transport', 'debit', [
    'Fuel',
    'Public transport',
    'Taxi and ride-hailing',
    'Parking and tolls',
    'Car maintenance',
    'Car purchase and lease',
  ]),
  group('Insurance', 'debit', [
    'Health insurance',
    'Home insurance',
    'Car insurance',
    'Life insurance',
    'Other insurance',
  ]),
  group('Taxes', 'debit', ['Income tax', 'Property tax', 'Local taxes', 'Other taxes']),
  group('Subscriptions', 'debit', [
    'Streaming',
    'Software and cloud',
    'Press and books',
    'Memberships',
  ]),
  group('Health', 'debit', ['Doctor', 'Dentist', 'Pharmacy', 'Optician', 'Hospital', 'Therapy']),
  group('Children', 'debit', [
    'Childcare',
    'School',
    'Children activities',
    'Clothing and gear',
    'Allowance',
  ]),
  group('Education', 'debit', ['Tuition', 'Courses', 'Study material']),
  group('Leisure', 'debit', [
    'Sports and fitness',
    'Hobbies',
    'Culture and shows',
    'Games',
    'Outings',
  ]),
  group('Travel', 'debit', [
    'Accommodation',
    'Flights and trains',
    'Car rental',
    'Travel activities',
  ]),
  group('Shopping', 'debit', ['Clothing', 'Electronics', 'Home decor', 'Beauty and personal care']),
  group('Gifts and donations', 'debit', ['Gifts', 'Donations']),
  group('Pets', 'debit', ['Pet food', 'Vet and care']),
  group('Loans and fees', 'debit', ['Loan repayment', 'Bank fees', 'Interest paid', 'Fines']),
  group('Savings and investments', 'debit', ['Savings', 'Investments', 'Retirement']),
  group('Other expense', 'debit'),
];
