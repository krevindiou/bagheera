import { describe, expect, it } from 'vitest';
import { PAYMENT_METHOD_ID, TRANSFER_PAYMENT_METHOD_IDS } from './index';

describe('PAYMENT_METHOD_ID', () => {
  it('has a distinct id for every payment method', () => {
    const ids = Object.values(PAYMENT_METHOD_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TRANSFER_PAYMENT_METHOD_IDS', () => {
  it('is exactly the transfer debit/credit ids', () => {
    expect(TRANSFER_PAYMENT_METHOD_IDS).toEqual([
      PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      PAYMENT_METHOD_ID.TRANSFER_CREDIT,
    ]);
  });
});
