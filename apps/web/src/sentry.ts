import type { App } from 'vue';
import * as Sentry from '@sentry/vue';
import { router } from './router';
import { scrubBreadcrumb, scrubEvent } from './sentry-scrub';

/** No-op without VITE_SENTRY_DSN. */
export function initSentry(app: App): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    return;
  }
  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
