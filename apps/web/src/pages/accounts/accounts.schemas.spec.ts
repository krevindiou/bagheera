import { describe, expect, it } from 'vitest';
import {
  bankChoiceSchema,
  createAccountSchema,
  editAccountSchema,
  editBankSchema,
} from './accounts.schemas';

describe('editBankSchema', () => {
  it('accepts a 1-32 char name', () => {
    expect(editBankSchema.safeParse({ name: 'My Bank' }).success).toBe(true);
  });

  it('rejects an empty (post-trim) name', () => {
    expect(editBankSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a name over 32 chars', () => {
    expect(editBankSchema.safeParse({ name: 'a'.repeat(33) }).success).toBe(false);
  });
});

describe('editAccountSchema', () => {
  it('accepts a 1-64 char name', () => {
    expect(editAccountSchema.safeParse({ name: 'Checking' }).success).toBe(true);
  });

  it('rejects a name over 64 chars', () => {
    expect(editAccountSchema.safeParse({ name: 'a'.repeat(65) }).success).toBe(false);
  });
});

describe('bankChoiceSchema', () => {
  it('accepts exactly bankId set', () => {
    expect(bankChoiceSchema.safeParse({ bankId: '123' }).success).toBe(true);
  });

  it('accepts exactly bankName set', () => {
    expect(bankChoiceSchema.safeParse({ bankName: 'New Bank' }).success).toBe(true);
  });

  it('rejects both bankId and bankName set', () => {
    expect(bankChoiceSchema.safeParse({ bankId: '123', bankName: 'New Bank' }).success).toBe(false);
  });

  it('rejects neither bankId nor bankName set', () => {
    expect(bankChoiceSchema.safeParse({}).success).toBe(false);
  });
});

describe('createAccountSchema', () => {
  const base = { bankId: 'b1', name: 'Checking', currency: 'USD' };

  it('accepts a valid account with no initial balance', () => {
    expect(createAccountSchema.safeParse(base).success).toBe(true);
  });

  it('treats an empty-string initialBalance as omitted', () => {
    const result = createAccountSchema.safeParse({ ...base, initialBalance: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initialBalance).toBeUndefined();
  });

  it('coerces a numeric-string initialBalance to a number', () => {
    const result = createAccountSchema.safeParse({ ...base, initialBalance: '42.5' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initialBalance).toBe(42.5);
  });

  it("rejects a currency code that isn't exactly 3 chars", () => {
    expect(createAccountSchema.safeParse({ ...base, currency: 'US' }).success).toBe(false);
  });

  it('rejects a missing bankId', () => {
    expect(createAccountSchema.safeParse({ ...base, bankId: '' }).success).toBe(false);
  });
});
