import * as Sentry from '@sentry/node';

/**
 * No-ops when SENTRY_DSN isn't set (local dev, CI, most integration tests),
 * so this is safe to call unconditionally from main.ts. Must run before
 * anything else imports code that needs instrumenting, hence its own module
 * imported first thing in main.ts rather than folded into a Nest module.
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
