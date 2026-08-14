import type { App } from "vue";
import * as Sentry from "@sentry/vue";
import { router } from "./router";

/**
 * No-ops when VITE_SENTRY_DSN isn't set (local dev, CI, e2e), so this is
 * safe to call unconditionally from main.ts.
 */
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
  });
}
