import type { components } from '../../api/schema';

type Schemas = components['schemas'];

// Derived from the generated API schema; server-only bookkeeping columns are
// left out. Amounts are minor units (real value × 10,000).
export type Operation = Omit<Schemas['OperationDto'], 'createdAt' | 'updatedAt'>;

export type OperationList = Omit<Schemas['OperationListDto'], 'items'> & { items: Operation[] };

export type Category = Schemas['CategoryDto'];

// Displayed as "Parent > Child" when nested.
export function categoryLabel(category: Category, allCategories: Category[]): string {
  const parent = category.parentId
    ? allCategories.find((c) => c.id === category.parentId)
    : undefined;
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

export interface CategoryGroup {
  // null label = top-level categories with no children of their own —
  // rendered as plain options outside any <optgroup>.
  label: string | null;
  categories: Category[];
}

// Category choice lists are grouped (here, by parent — a top-level
// category with children becomes an <optgroup>, itself included as the
// group's first, still-selectable option).
export function groupCategories(categories: Category[]): CategoryGroup[] {
  const topLevel = categories.filter((c) => c.parentId === null);
  const groups: CategoryGroup[] = [];
  const standalone: Category[] = [];
  for (const top of topLevel) {
    const children = categories.filter((c) => c.parentId === top.id);
    if (children.length > 0) {
      groups.push({ label: top.name, categories: [top, ...children] });
    } else {
      standalone.push(top);
    }
  }
  return standalone.length > 0 ? [{ label: null, categories: standalone }, ...groups] : groups;
}

// Fetched live from GET /reference-data/payment-methods (the same fixed,
// seeded list as apps/api/src/db/seed-data.ts — ids are stable UUID
// literals relied on across the app), the same way categories already are.
// `type` is null only for the Initial balance method (the system-generated
// opening operation) — never a user choice, and naturally excluded from
// any debit/credit-filtered choice list since null matches neither.
export type PaymentMethod = Schemas['PaymentMethodDto'];

// Mirrors apps/api/src/db/seed-data.ts's PAYMENT_METHOD_ID — the same fixed
// UUID literals, not DB-generated. Named lookup, not array position, is
// what business logic (icons, the transfer-method check below) keys off.
export const PAYMENT_METHOD_ID = {
  CREDIT_CARD: '00000000-0000-7000-8000-000000000001',
  CHECK_DEBIT: '00000000-0000-7000-8000-000000000002',
  CASH_WITHDRAWAL: '00000000-0000-7000-8000-000000000003',
  TRANSFER_DEBIT: '00000000-0000-7000-8000-000000000004',
  CHECK_CREDIT: '00000000-0000-7000-8000-000000000005',
  TRANSFER_CREDIT: '00000000-0000-7000-8000-000000000006',
  DEPOSIT: '00000000-0000-7000-8000-000000000007',
  DIRECT_DEBIT: '00000000-0000-7000-8000-000000000008',
  INITIAL_BALANCE: '00000000-0000-7000-8000-000000000009',
} as const;

export function paymentMethodName(id: string, paymentMethods: PaymentMethod[]): string {
  return paymentMethods.find((pm) => pm.id === id)?.name ?? id;
}

// Display icons: initial balance = gauge, credit card = card, check =
// list, cash withdrawal/deposit = money, transfer/direct debit =
// exchange arrows. Web-only — no equivalent column server-side.
export const PAYMENT_METHOD_ICONS: Record<string, string> = {
  [PAYMENT_METHOD_ID.CREDIT_CARD]: '💳',
  [PAYMENT_METHOD_ID.CHECK_DEBIT]: '📋',
  [PAYMENT_METHOD_ID.CASH_WITHDRAWAL]: '💵',
  [PAYMENT_METHOD_ID.TRANSFER_DEBIT]: '🔁',
  [PAYMENT_METHOD_ID.CHECK_CREDIT]: '📋',
  [PAYMENT_METHOD_ID.TRANSFER_CREDIT]: '🔁',
  [PAYMENT_METHOD_ID.DEPOSIT]: '💵',
  [PAYMENT_METHOD_ID.DIRECT_DEBIT]: '🔁',
  [PAYMENT_METHOD_ID.INITIAL_BALANCE]: '🎚️',
};

export function paymentMethodIcon(id: string): string {
  return PAYMENT_METHOD_ICONS[id] ?? '';
}

// The "Transfer" debit/credit payment methods — the only two that can carry
// a transfer pairing (apps/api/src/operations/transfer.service.ts). A fixed
// business rule, not reference data — stays static regardless of where the
// payment-method list itself comes from.
export const TRANSFER_PAYMENT_METHOD_IDS: readonly string[] = [
  PAYMENT_METHOD_ID.TRANSFER_DEBIT,
  PAYMENT_METHOD_ID.TRANSFER_CREDIT,
];

export type SearchCriteria = Schemas['SearchCriteriaDto'];
export type AmountComparator = Schemas['AmountComparatorDto'];
export type AmountComparatorOperator = AmountComparator['operator'];
