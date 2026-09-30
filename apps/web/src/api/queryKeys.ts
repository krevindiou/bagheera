// Central query-key registry: every useQuery/invalidateQueries call in the
// app builds its key from here instead of a hand-typed literal array — a
// typo in a literal silently skips invalidation instead of erroring.
//
// TanStack invalidateQueries matches by prefix by default: passing a
// shorter key invalidates every cached query whose key starts with it.
// Each entry below that also varies by a page/range exposes that shorter
// `.all(...)` prefix specifically for invalidation, alongside the full key
// a query itself reads/writes — so invalidating "operations for this
// account" clears every cached page, not just whichever one happens to be
// showing.
export const queryKeys = {
  accounts: ['accounts'] as const,
  banks: ['banks'] as const,
  categories: ['categories'] as const,
  paymentMethods: ['payment-methods'] as const,

  dashboard: {
    all: ['dashboard'] as const,
    range: (range: string) => ['dashboard', range] as const,
  },
  balance: (accountId: string) => ['balance', accountId] as const,
  chart: {
    all: (accountId: string) => ['chart', accountId] as const,
    range: (accountId: string, range: string) => ['chart', accountId, range] as const,
  },
  operations: {
    all: (accountId: string) => ['operations', accountId] as const,
    page: (accountId: string, page: number) => ['operations', accountId, page] as const,
  },
  schedulers: {
    all: (accountId: string) => ['schedulers', accountId] as const,
    page: (accountId: string, page: number) => ['schedulers', accountId, page] as const,
  },

  webauthnCredentials: ['webauthn-credentials'] as const,

  reports: ['reports'] as const,
  // Callers key this off `viewingReportId`, which is `null` until a report
  // row is expanded — the query itself stays gated by TanStack's `enabled`
  // until it's set, but the key still needs to accept `null` meanwhile.
  reportSeries: (reportId: string | null) => ['report-series', reportId] as const,
  reportDistribution: (reportId: string | null) => ['report-distribution', reportId] as const,
} as const;
