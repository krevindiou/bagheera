// Branded so one entity's id can't be passed where another's — or the
// signed-in member's id — is expected, catching an argument-order mixup
// (e.g. `requireOwnedAccount(memberId, id)`) at compile time instead of a
// silently-wrong ownership check at runtime. Same __brand pattern as
// packages/money/src/index.ts's MinorUnits/MajorUnits.
//
// These only exist at the OwnershipService boundary (see ownership.service.ts):
// a route param or DTO field stays plain `string` everywhere else and gets
// cast (`id as BankId`) right at the call into `requireOwned*`/`filterOwned*Ids`
// — branding every id through every controller/DTO/service signature would
// ripple far wider for no extra safety, since the swap this guards against
// only happens at that one call boundary.
export type MemberId = string & { readonly __brand: 'MemberId' };
export type BankId = string & { readonly __brand: 'BankId' };
export type AccountId = string & { readonly __brand: 'AccountId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type SchedulerId = string & { readonly __brand: 'SchedulerId' };
export type ReportId = string & { readonly __brand: 'ReportId' };
