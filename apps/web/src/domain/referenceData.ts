import {
  MAX_SIGNIFICANT_RESULTS_NUMBER,
  PAYMENT_METHOD_ID,
  TRANSFER_PAYMENT_METHOD_IDS,
} from '@bagheera/reference-data';
import type { components } from '../api/schema';
import type { IconName } from '../components/appIcons';
import { referenceName } from '../i18n/referenceNames';

type Schemas = components['schemas'];

// Derived from the generated API schema; server-only bookkeeping columns are
// left out. Amounts are minor units (real value × 10,000).
export type Operation = Omit<Schemas['OperationDto'], 'createdAt' | 'updatedAt'>;

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

// Groups by parent: a top-level category with children becomes an
// <optgroup>, itself its first, still selectable option.
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

// `type` is null only for Initial balance, so type-filtered choice lists
// never offer it.
export type PaymentMethod = Schemas['PaymentMethodDto'];

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

// Web-only: the API has no icon column.
const PAYMENT_METHOD_ICONS: Record<string, IconName> = {
  [PAYMENT_METHOD_ID.CREDIT_CARD]: 'card',
  [PAYMENT_METHOD_ID.CHECK_DEBIT]: 'checkList',
  [PAYMENT_METHOD_ID.CASH_WITHDRAWAL]: 'cash',
  [PAYMENT_METHOD_ID.TRANSFER_DEBIT]: 'transfer',
  [PAYMENT_METHOD_ID.CHECK_CREDIT]: 'checkList',
  [PAYMENT_METHOD_ID.TRANSFER_CREDIT]: 'transfer',
  [PAYMENT_METHOD_ID.DEPOSIT]: 'cash',
  [PAYMENT_METHOD_ID.DIRECT_DEBIT]: 'transfer',
  [PAYMENT_METHOD_ID.INITIAL_BALANCE]: 'gauge',
};

export function paymentMethodIcon(id: string): IconName | null {
  return PAYMENT_METHOD_ICONS[id] ?? null;
}

export { MAX_SIGNIFICANT_RESULTS_NUMBER, TRANSFER_PAYMENT_METHOD_IDS };

export type SearchCriteria = Schemas['SearchCriteriaDto'];
export type AmountComparator = Schemas['AmountComparatorDto'];
export type AmountComparatorOperator = AmountComparator['operator'];
