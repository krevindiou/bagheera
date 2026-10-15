import { AMOUNT_CEILING } from '@bagheera/money';
import { FIELD_LIMITS } from '@bagheera/reference-data';
import { describe, expect, it } from 'vitest';
import { PAYMENT_METHOD_ID } from '../../domain/referenceData';
import { schedulerSchema } from './schedulers.schemas';

// Any well-formed uuid stands in for an account id here — the schema only
// checks shape, not what the id actually refers to.
const ACCOUNT_ID = '00000000-0000-7000-8000-000000000099';

const base = {
  type: 'debit' as const,
  thirdParty: 'Rent',
  amount: 1000,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  valueDate: '2026-01-01',
  frequencyUnit: 'month' as const,
  frequencyValue: 1,
};

describe('schedulerSchema', () => {
  it('accepts a minimal valid scheduler', () => {
    expect(schedulerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an amount over the sanity ceiling', () => {
    expect(schedulerSchema.safeParse({ ...base, amount: AMOUNT_CEILING + 1 }).success).toBe(false);
  });

  it('rejects a zero or fractional frequencyValue', () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: 0 }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: 1.5 }).success).toBe(false);
  });

  it('accepts a frequencyValue at the cap and rejects one above it', () => {
    const max = FIELD_LIMITS.FREQUENCY_VALUE;
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: max }).success).toBe(true);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: max + 1 }).success).toBe(false);
  });

  it('rejects a missing frequencyValue (empty string, undefined, or null)', () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: '' }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: undefined }).success).toBe(false);
    expect(schedulerSchema.safeParse({ ...base, frequencyValue: null }).success).toBe(false);
  });

  it('rejects an invalid frequencyUnit', () => {
    expect(schedulerSchema.safeParse({ ...base, frequencyUnit: 'invalid' }).success).toBe(false);
  });

  it('treats an empty-string limitDate as omitted', () => {
    const result = schedulerSchema.safeParse({ ...base, limitDate: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limitDate).toBeUndefined();
  });

  it('accepts a transfer payment method with no transferAccountId, as External', () => {
    for (const transferAccountId of [undefined, '']) {
      const result = schedulerSchema.safeParse({
        ...base,
        paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        transferAccountId,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.transferAccountId).toBeUndefined();
    }
  });

  it('accepts a transfer payment method with a transferAccountId', () => {
    expect(
      schedulerSchema.safeParse({
        ...base,
        paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        transferAccountId: ACCOUNT_ID,
      }).success,
    ).toBe(true);
  });

  it('rejects a valueDate outside the range the API accepts', () => {
    expect(schedulerSchema.safeParse({ ...base, valueDate: '2101-01-01' }).success).toBe(false);
  });

  it('treats an empty limitDate as omitted', () => {
    const result = schedulerSchema.safeParse({ ...base, limitDate: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limitDate).toBeUndefined();
  });

  it('rejects a limitDate outside the range the API accepts', () => {
    expect(schedulerSchema.safeParse({ ...base, limitDate: '2101-01-01' }).success).toBe(false);
  });

  it('accepts a limitDate on or after valueDate', () => {
    expect(
      schedulerSchema.safeParse({ ...base, valueDate: '2026-07-05', limitDate: '2026-08-01' })
        .success,
    ).toBe(true);
    expect(
      schedulerSchema.safeParse({ ...base, valueDate: '2026-07-05', limitDate: '2026-07-05' })
        .success,
    ).toBe(true);
  });

  it('rejects a limitDate before valueDate, flagging limitDate', () => {
    const result = schedulerSchema.safeParse({
      ...base,
      valueDate: '2026-07-05',
      limitDate: '2026-06-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['limitDate'],
        message: 'beforeValueDate',
      });
    }
  });
});
