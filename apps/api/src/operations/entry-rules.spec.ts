import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import {
  amountFields,
  requireFullyActive,
  transferAccountIdFor,
  validateTypedRefs,
} from './entry-rules';

const active = { closed: false, deleted: false };

describe('requireFullyActive', () => {
  it('accepts an active account in an active bank', () => {
    expect(() => requireFullyActive({ account: active, bank: active })).not.toThrow();
  });

  it.each([
    ['closed account', { account: { closed: true, deleted: false }, bank: active }],
    ['deleted account', { account: { closed: false, deleted: true }, bank: active }],
    ['closed bank', { account: active, bank: { closed: true, deleted: false } }],
    ['deleted bank', { account: active, bank: { closed: false, deleted: true } }],
  ])('rejects a %s', (_name, row) => {
    expect(() => requireFullyActive(row)).toThrow(UnprocessableEntityException);
  });
});

describe('validateTypedRefs', () => {
  function dbWith(...results: unknown[][]) {
    const where = jest.fn();
    results.forEach((rows) => where.mockResolvedValueOnce(rows));
    return { select: () => ({ from: () => ({ where }) }) } as unknown as NodePgDatabase;
  }

  it('accepts a payment method and category of the entry type', async () => {
    const db = dbWith([{ type: 'debit' }], [{ type: 'debit' }]);
    await expect(validateTypedRefs(db, 'debit', 'pm', 'cat')).resolves.toBeUndefined();
  });

  it('skips the category lookup when there is none', async () => {
    await expect(
      validateTypedRefs(dbWith([{ type: 'credit' }]), 'credit', 'pm'),
    ).resolves.toBeUndefined();
  });

  it('rejects an unknown or wrong-type payment method', async () => {
    await expect(validateTypedRefs(dbWith([]), 'debit', 'pm')).rejects.toThrow(BadRequestException);
    await expect(validateTypedRefs(dbWith([{ type: 'credit' }]), 'debit', 'pm')).rejects.toThrow(
      'Invalid payment method',
    );
  });

  it('rejects an unknown or wrong-type category', async () => {
    await expect(
      validateTypedRefs(dbWith([{ type: 'debit' }], [{ type: 'credit' }]), 'debit', 'pm', 'cat'),
    ).rejects.toThrow('Invalid category');
    await expect(
      validateTypedRefs(dbWith([{ type: 'debit' }], []), 'debit', 'pm', 'cat'),
    ).rejects.toThrow('Invalid category');
  });
});

describe('amountFields', () => {
  it('puts the amount on the side matching the type, in minor units', () => {
    expect(amountFields('debit', 1.5)).toEqual({ debit: 15000, credit: null });
    expect(amountFields('credit', 1.5)).toEqual({ debit: null, credit: 15000 });
  });
});

describe('transferAccountIdFor', () => {
  it('keeps the target only for transfer payment methods', () => {
    expect(transferAccountIdFor(PAYMENT_METHOD_ID.TRANSFER_DEBIT, 'acc')).toBe('acc');
    expect(transferAccountIdFor(PAYMENT_METHOD_ID.TRANSFER_DEBIT)).toBeNull();
    expect(transferAccountIdFor(PAYMENT_METHOD_ID.CREDIT_CARD, 'acc')).toBeNull();
  });
});
