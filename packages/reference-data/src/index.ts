// Fixed reference-data ids shared by apps/api and apps/web, so the two
// never drift out of sync (see apps/api/src/db/seed-data.ts and
// apps/web/src/pages/operations/operations.types.ts, both thin re-exports
// of this). Ids are fixed UUID literals, not DB-generated — the whole
// point of a fixed reference list is that they stay stable across
// environments/reseeds, and business logic on both sides keys off them by
// name rather than repeating the literals.
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

// The "Transfer" debit/credit payment methods — the only two that can carry
// a transfer pairing (apps/api/src/operations/transfer.service.ts) or be
// chosen as one in a form (apps/web). A fixed business rule, not reference
// data proper, but it lives here rather than a duplicate array on each
// side since it's keyed directly off PAYMENT_METHOD_ID above.
export const TRANSFER_PAYMENT_METHOD_IDS: readonly string[] = [
  PAYMENT_METHOD_ID.TRANSFER_DEBIT,
  PAYMENT_METHOD_ID.TRANSFER_CREDIT,
];
