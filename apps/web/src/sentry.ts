import type { App } from 'vue';
import * as Sentry from '@sentry/vue';
import { router } from './router';
import { scrubBreadcrumb, scrubEvent } from './sentry-scrub';

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: { sentryDsn?: string };
  }
}

/**
 * No-op without a DSN. It comes from /runtime-config.js, which the web
 * container renders from its env (docker/Caddyfile), so the image itself
 * carries no DSN.
 */
export function initSentry(app: App): void {
  const dsn = window.__RUNTIME_CONFIG__?.sentryDsn;
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
