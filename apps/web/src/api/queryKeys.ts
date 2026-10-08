// Every query key comes from here: a typo in a literal key silently skips
// invalidation. Paged/ranged entries expose an `.all(...)` prefix, since
// invalidateQueries matches by prefix and should clear every page.
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
  // `null` until a report is expanded (the query is disabled meanwhile).
  reportSeries: (reportId: string | null) => ['report-series', reportId] as const,
  reportDistribution: (reportId: string | null) => ['report-distribution', reportId] as const,
} as const;
