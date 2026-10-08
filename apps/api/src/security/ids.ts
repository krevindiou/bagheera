// Branded ids catch argument-order mixups (e.g.
// `requireOwnedAccount(memberId, id)`) at compile time. Used at the
// OwnershipService boundary: ids stay plain `string` elsewhere and are cast
// at the call.
export type MemberId = string & { readonly __brand: 'MemberId' };
export type BankId = string & { readonly __brand: 'BankId' };
export type AccountId = string & { readonly __brand: 'AccountId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type SchedulerId = string & { readonly __brand: 'SchedulerId' };
export type ReportId = string & { readonly __brand: 'ReportId' };
