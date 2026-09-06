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
}
