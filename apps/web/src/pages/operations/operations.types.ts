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
  isSalaryCategory: boolean;
}

// Fixed reference list — ids/names/types are stable identifiers relied on
// across the app (apps/api/src/db/seed-data.ts), not fetched dynamically.
// Id 9 ("Initial balance") is reserved for the system-generated opening
// operation and is deliberately excluded — it's never a user choice.
export const PAYMENT_METHOD_NAMES: Record<number, string> = {
  1: "Credit card",
  2: "Check",
  3: "Cash withdrawal",
  4: "Transfer",
  5: "Check",
  6: "Transfer",
  7: "Deposit",
  8: "Direct debit",
  9: "Initial balance",
};

const PAYMENT_METHOD_TYPES: Record<number, "debit" | "credit"> = {
  1: "debit",
  2: "debit",
  3: "debit",
  4: "debit",
  5: "credit",
  6: "credit",
  7: "credit",
  8: "debit",
};

export const PAYMENT_METHODS: { id: number; name: string; type: "debit" | "credit" }[] = Object.entries(
  PAYMENT_METHOD_TYPES,
).map(([id, type]) => ({ id: Number(id), name: PAYMENT_METHOD_NAMES[Number(id)], type }));

// Payment method ids 4 (debit) and 6 (credit) — the only two that can carry
// a transfer pairing (apps/api/src/operations/transfer.service.ts).
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
