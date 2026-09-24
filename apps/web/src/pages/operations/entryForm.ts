import { toDisplayAmount, today } from './money';
import type { OperationForm } from './operations.schemas';
import { TRANSFER_PAYMENT_METHOD_IDS } from './operations.types';

// What an operation and a scheduler share: the row as the API returns it.
interface EntryRow {
  debit: number | null;
  credit: number | null;
  thirdParty: string;
  categoryId: string | null;
  paymentMethodId: string;
  transferAccountId: string | null;
  valueDate: string;
  notes: string;
  reconciled: boolean;
}

// The operation-like form's starting values: the stored row when editing,
// a blank debit dated today otherwise.
export function entryFormValues(entry: EntryRow | null): OperationForm {
  if (!entry) {
    return {
      type: 'debit',
      thirdParty: '',
      amount: undefined as unknown as number,
      categoryId: undefined,
      paymentMethodId: undefined as unknown as string,
      transferAccountId: undefined,
      valueDate: today(),
      notes: '',
      reconciled: false,
    };
  }
  return {
    type: entry.debit !== null ? 'debit' : 'credit',
    thirdParty: entry.thirdParty,
    amount: toDisplayAmount((entry.debit ?? entry.credit)!),
    categoryId: entry.categoryId ?? undefined,
    paymentMethodId: entry.paymentMethodId,
    transferAccountId: entry.transferAccountId ?? undefined,
    valueDate: entry.valueDate,
    notes: entry.notes,
    reconciled: entry.reconciled,
  };
}

// The request body fields an operation and a scheduler share. A transfer
// account only means something for a transfer payment method, so it's
// dropped for any other.
export function entryRequestFields(accountId: string, submitted: OperationForm) {
  return {
    accountId,
    type: submitted.type,
    thirdParty: submitted.thirdParty,
    amount: submitted.amount,
    categoryId: submitted.categoryId,
    paymentMethodId: submitted.paymentMethodId,
    transferAccountId: TRANSFER_PAYMENT_METHOD_IDS.includes(submitted.paymentMethodId)
      ? submitted.transferAccountId
      : undefined,
    valueDate: submitted.valueDate,
    notes: submitted.notes,
    reconciled: submitted.reconciled,
  };
}
