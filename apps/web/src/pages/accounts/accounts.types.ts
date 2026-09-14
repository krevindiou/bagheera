// The bank/account controllers return plain rows (no @ApiOkResponse DTOs),
// so the generated API client types their bodies as `Record<string, never>`.
// These mirror the actual shapes (apps/api/src/db/schema/{bank,account}.ts).
export interface Bank {
  id: string;
  name: string;
  closed: boolean;
  deleted: boolean;
}

export interface Account {
  id: string;
  bankId: string;
  name: string;
  currency: string;
  closed: boolean;
  deleted: boolean;
  // Only present on the `GET /accounts` list response (AccountService.list
  // attaches these as display-only fields for the accounts screen) —
  // omitted from fixtures/props elsewhere, hence optional.
  balance?: number;
  reconciledBalance?: number;
}
