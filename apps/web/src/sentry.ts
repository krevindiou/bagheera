import type { App } from 'vue';
import * as Sentry from '@sentry/vue';
import { router } from './router';
import { scrubBreadcrumb, scrubEvent, scrubLog } from './sentry-scrub';

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
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    ],
    // Every page load and navigation is traced: traffic is low enough to
    // stay within quota.
    tracesSampleRate: 1,
    // Query strings carry typed search text and emailed one-time keys; the
    // visitor's address is personal data.
    dataCollection: { urlQueryParams: false, userInfo: false },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendLog: scrubLog,
  });
}
