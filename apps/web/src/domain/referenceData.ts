import { PAYMENT_METHOD_ID, TRANSFER_PAYMENT_METHOD_IDS } from '@bagheera/reference-data';
import type { components } from '../api/schema';
import { referenceName } from '../i18n/referenceNames';

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
  return parent
    ? `${referenceName(parent.name)} > ${referenceName(category.name)}`
    : referenceName(category.name);
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
      groups.push({ label: referenceName(top.name), categories: [top, ...children] });
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

// The fixed UUID literals themselves live in packages/reference-data,
// shared with apps/api (see db/seed-data.ts) — re-exported here so
// existing `PAYMENT_METHOD_ID` imports from this module don't change.
// Named lookup, not array position, is what business logic (icons, the
// transfer-method check below) keys off.
export { PAYMENT_METHOD_ID };

export function paymentMethodName(id: string, paymentMethods: PaymentMethod[]): string {
  const name = paymentMethods.find((pm) => pm.id === id)?.name;
  return name === undefined ? id : referenceName(name);
}

// The third party as displayed: the system-generated opening operation is
// stored with an English placeholder, so it is labeled from its payment
// method instead.
export function thirdPartyLabel(thirdParty: string, paymentMethodId: string): string {
  return paymentMethodId === PAYMENT_METHOD_ID.INITIAL_BALANCE
    ? referenceName('Initial balance')
    : thirdParty;
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
// a transfer pairing (apps/api/src/operations/transfer.service.ts) —
// re-exported here so existing imports of it from this module don't change.
export { TRANSFER_PAYMENT_METHOD_IDS };

export type SearchCriteria = Schemas['SearchCriteriaDto'];
export type AmountComparator = Schemas['AmountComparatorDto'];
export type AmountComparatorOperator = AmountComparator['operator'];
