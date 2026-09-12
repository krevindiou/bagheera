import { describe, expect, it } from 'vitest';
import type { Account, Bank } from '../pages/accounts/accounts.types';
import { useTransferTargets } from './useTransferTargets';

const bank = (id: string, closed = false): Bank => ({
  id,
  name: `Bank ${id}`,
  closed,
  deleted: false,
});
const account = (id: string, bankId: string, currency: string, closed = false): Account => ({
  id,
  bankId,
  name: `Account ${id}`,
  currency,
  closed,
  deleted: false,
});

describe('useTransferTargets', () => {
  it('offers other accounts in the same currency', () => {
    const banks = [bank('b1')];
    const accounts = [
      account('a1', 'b1', 'USD'),
      account('a2', 'b1', 'USD'),
      account('a3', 'b1', 'EUR'),
    ];
    const { transferTargets } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => undefined,
    );
    expect(transferTargets.value.map((a) => a.id)).toEqual(['a2']);
  });

  it('excludes a closed account', () => {
    const banks = [bank('b1')];
    const accounts = [account('a1', 'b1', 'USD'), account('a2', 'b1', 'USD', true)];
    const { transferTargets } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => undefined,
    );
    expect(transferTargets.value).toEqual([]);
  });

  it('excludes an account whose bank is closed', () => {
    const banks = [bank('b1'), bank('b2', true)];
    const accounts = [account('a1', 'b1', 'USD'), account('a2', 'b2', 'USD')];
    const { transferTargets } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => undefined,
    );
    expect(transferTargets.value).toEqual([]);
  });

  it("keeps a stored transfer target selectable even once it's gone inactive", () => {
    const banks = [bank('b1')];
    const accounts = [account('a1', 'b1', 'USD'), account('a2', 'b1', 'USD', true)];
    const { transferTargets } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => 'a2',
    );
    expect(transferTargets.value.map((a) => a.id)).toEqual(['a2']);
  });

  it("doesn't duplicate the stored target when it's still eligible on its own", () => {
    const banks = [bank('b1')];
    const accounts = [account('a1', 'b1', 'USD'), account('a2', 'b1', 'USD')];
    const { transferTargets } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => 'a2',
    );
    expect(transferTargets.value.map((a) => a.id)).toEqual(['a2']);
  });

  it("exposes the source account's currency symbol", () => {
    const banks = [bank('b1')];
    const accounts = [account('a1', 'b1', 'USD')];
    const { amountCurrencySymbol } = useTransferTargets(
      () => 'a1',
      () => accounts,
      () => banks,
      () => undefined,
    );
    expect(amountCurrencySymbol.value).toBe('$');
  });

  it("returns an empty currency symbol when the source account isn't found", () => {
    const { amountCurrencySymbol } = useTransferTargets(
      () => 'missing',
      () => [],
      () => [],
      () => undefined,
    );
    expect(amountCurrencySymbol.value).toBe('');
  });
});
