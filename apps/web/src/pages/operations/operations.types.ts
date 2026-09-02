// The operation/reference-data controllers return plain rows (no
// @ApiOkResponse DTOs), so the generated API client types their bodies as
// `Record<string, never>`. These mirror the actual shapes
// (apps/api/src/db/schema/{operation,category,payment-method}.ts).
export interface Operation {
  id: number;
  accountId: number;
  schedulerId: number | null;
  transferOperationId: number | null;
  transferAccountId: number | null;
  categoryId: number | null;
  paymentMethodId: number;
  thirdParty: string;
  // Minor units (real value × 10,000); exactly one of debit/credit is set.
  debit: number | null;
  credit: number | null;
  valueDate: string;
  reconciled: boolean;
  notes: string;
}

export interface OperationList {
  items: Operation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  id: number;
  parentId: number | null;
  type: "debit" | "credit";
  name: string;
}

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
// seeded list as apps/api/src/db/seed-data.ts — ids are stable identifiers
// relied on across the app), the same way categories already are. `type`
// is null only for id 9 ("Initial balance", the system-generated opening
// operation) — never a user choice, and naturally excluded from any
// debit/credit-filtered choice list since null matches neither.
export interface PaymentMethod {
  id: number;
  name: string;
  type: "debit" | "credit" | null;
}

export function paymentMethodName(id: number, paymentMethods: PaymentMethod[]): string {
  return paymentMethods.find((pm) => pm.id === id)?.name ?? String(id);
}

// Display icons: initial balance = gauge, credit card = card, check =
// list, cash withdrawal/deposit = money, transfer/direct debit =
// exchange arrows. Web-only — no equivalent column server-side.
export const PAYMENT_METHOD_ICONS: Record<number, string> = {
  1: "💳",
  2: "📋",
  3: "💵",
  4: "🔁",
  5: "📋",
  6: "🔁",
  7: "💵",
  8: "🔁",
  9: "🎚️",
};

export function paymentMethodIcon(id: number): string {
  return PAYMENT_METHOD_ICONS[id] ?? "";
}

// Payment method ids 4 (debit) and 6 (credit) — the only two that can carry
// a transfer pairing (apps/api/src/operations/transfer.service.ts). A fixed
// business rule, not reference data — stays static regardless of where the
// payment-method list itself comes from.
export const TRANSFER_PAYMENT_METHOD_IDS: readonly number[] = [4, 6];

export type AmountComparatorOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export interface AmountComparator {
  operator: AmountComparatorOperator;
  value: number;
}

// Mirrors apps/api/src/operations/dto/search-operations.dto.ts, minus
// accountId (that's the recall key's scope, carried separately).
export interface SearchCriteria {
  type?: "debit" | "credit";
  thirdParty?: string;
  categoryIds?: number[];
  paymentMethodIds?: number[];
  amountComparators?: AmountComparator[];
  dateFrom?: string;
  dateTo?: string;
  notes?: string;
  reconciled?: boolean;
}
