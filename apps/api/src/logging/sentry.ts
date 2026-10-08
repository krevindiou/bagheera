import * as Sentry from '@sentry/node';

/**
 * No-op without SENTRY_DSN. Called in main.ts before AppModule is
 * imported, so instrumentation is in place first.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
  });
}

export { Sentry };
