import { describe, expect, it } from 'vitest';
import { entryFormValues, entryRequestFields } from './entryForm';
import { today } from './money';
import type { OperationForm } from './operations.schemas';
import { PAYMENT_METHOD_ID } from './operations.types';

const row = {
  debit: 500000 as number | null,
  credit: null as number | null,
  thirdParty: 'Landlord',
  categoryId: 'c1' as string | null,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  transferAccountId: null as string | null,
  valueDate: '2026-01-15',
  notes: 'rent',
  reconciled: true,
};

describe('entryFormValues', () => {
  it('starts a new entry as an empty debit dated today', () => {
    expect(entryFormValues(null)).toEqual({
      type: 'debit',
      thirdParty: '',
      amount: undefined,
      categoryId: undefined,
      paymentMethodId: undefined,
      transferAccountId: undefined,
      valueDate: today(),
      notes: '',
      reconciled: false,
    });
  });

  it('turns a stored debit into a debit form with its amount in major units', () => {
    expect(entryFormValues(row)).toEqual({
      type: 'debit',
      thirdParty: 'Landlord',
      amount: 50,
      categoryId: 'c1',
      paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
      transferAccountId: undefined,
      valueDate: '2026-01-15',
      notes: 'rent',
      reconciled: true,
    });
  });

  it('turns a stored credit into a credit form', () => {
    const values = entryFormValues({ ...row, debit: null, credit: 20000, categoryId: null });

    expect(values.type).toBe('credit');
    expect(values.amount).toBe(2);
    expect(values.categoryId).toBeUndefined();
  });

  it('keeps a stored transfer account', () => {
    expect(entryFormValues({ ...row, transferAccountId: 'a2' }).transferAccountId).toBe('a2');
  });
});

describe('entryRequestFields', () => {
  const submitted: OperationForm = {
    type: 'debit',
    thirdParty: 'Landlord',
    amount: 50,
    categoryId: 'c1',
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    transferAccountId: 'a2',
    valueDate: '2026-01-15',
    notes: 'rent',
    reconciled: false,
  };

  it('carries the form values with the account id', () => {
    expect(entryRequestFields('a1', submitted)).toMatchObject({
      accountId: 'a1',
      type: 'debit',
      thirdParty: 'Landlord',
      amount: 50,
      categoryId: 'c1',
      valueDate: '2026-01-15',
      notes: 'rent',
      reconciled: false,
    });
  });

  it('drops the transfer account for a non-transfer payment method', () => {
    expect(entryRequestFields('a1', submitted).transferAccountId).toBeUndefined();
  });

  it('keeps the transfer account for a transfer payment method', () => {
    const fields = entryRequestFields('a1', {
      ...submitted,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    });

    expect(fields.transferAccountId).toBe('a2');
  });
});
