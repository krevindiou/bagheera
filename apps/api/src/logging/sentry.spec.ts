import * as Sentry from '@sentry/node';
import { vi } from 'vitest';
import { initSentry } from './sentry';

vi.mock('@sentry/node', () => ({ init: vi.fn() }));

describe('initSentry', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
    vi.clearAllMocks();
  });

  it('does not initialise Sentry without a DSN', () => {
    delete process.env.SENTRY_DSN;

    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('keeps incoming request bodies out of events', () => {
    process.env.SENTRY_DSN = 'https://key@example.invalid/1';

    initSentry();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      dsn: 'https://key@example.invalid/1',
      dataCollection: { httpBodies: [] },
    });
  });
});
