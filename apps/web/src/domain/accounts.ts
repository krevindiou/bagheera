import type { Account, Bank } from '../pages/accounts/accounts.types';

// Disambiguates same-named accounts at different banks; falls back to the
// bare account name when the bank isn't known (e.g. not loaded yet).
export function accountLabel(account: Account, banks: Bank[]): string {
  const bank = banks.find((b) => b.id === account.bankId);
  return bank ? `${bank.name} — ${account.name}` : account.name;
}
