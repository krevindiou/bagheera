import type { components } from '../../api/schema';

type Schemas = components['schemas'];

// Derived from the generated API schema; server-only bookkeeping columns are
// left out.
export type Bank = Omit<Schemas['BankDto'], 'memberId' | 'createdAt' | 'updatedAt'>;

// `balance`/`reconciledBalance` are only present on the `GET /accounts` list
// response — omitted from fixtures/props elsewhere, hence optional.
export type Account = Omit<Schemas['AccountDto'], 'createdAt' | 'updatedAt'> &
  Partial<Pick<Schemas['AccountWithBalanceDto'], 'balance' | 'reconciledBalance'>>;
