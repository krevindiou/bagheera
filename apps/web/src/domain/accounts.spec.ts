import { describe, expect, it } from 'vitest';
import { accountLabel } from './accounts';
import type { Account, Bank } from '../pages/accounts/accounts.types';

const bank: Bank = { id: 'b1', name: 'Chase', closed: false, deleted: false };
const account: Account = {
  id: 'a1',
  bankId: 'b1',
  name: 'Checking',
  currency: 'USD',
  closed: false,
  deleted: false,
};

describe('accountLabel', () => {
  it("prefixes the account name with its bank's", () => {
    expect(accountLabel(account, [bank])).toBe('Chase — Checking');
  });

  it("falls back to the bare account name when its bank isn't known", () => {
    expect(accountLabel(account, [])).toBe('Checking');
  });
});
