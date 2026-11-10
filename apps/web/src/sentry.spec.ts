import type { App } from 'vue';
import * as Sentry from '@sentry/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initSentry } from './sentry';

vi.mock('@sentry/vue', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}));
vi.mock('./router', () => ({ router: {} }));

const app = {} as App;

describe('initSentry', () => {
  afterEach(() => {
    delete window.__RUNTIME_CONFIG__;
    vi.clearAllMocks();
  });

  it.each([
    ['no runtime config', undefined],
    ['no DSN in it', {}],
    ['an empty DSN', { sentryDsn: '' }],
  ])('does nothing with %s', (_label, config) => {
    window.__RUNTIME_CONFIG__ = config;

    initSentry(app);

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the runtime DSN', () => {
    window.__RUNTIME_CONFIG__ = { sentryDsn: 'https://key@sentry.example/1' };

    initSentry(app);

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ app, dsn: 'https://key@sentry.example/1', tracesSampleRate: 0 }),
    );
  });
});
