import * as Sentry from '@sentry/node';
import { vi } from 'vitest';
import { metrics } from './metrics';

vi.mock('@sentry/node', () => ({ metrics: { count: vi.fn() } }));

describe('metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts a security event by type', () => {
    metrics.securityEvent('webauthn_sign_in_failure');

    expect(Sentry.metrics.count).toHaveBeenCalledWith('security.event', 1, {
      attributes: { event: 'webauthn_sign_in_failure' },
    });
  });

  it('counts an email job by name and outcome', () => {
    metrics.emailJob('send', 'retrying');

    expect(Sentry.metrics.count).toHaveBeenCalledWith('email.job', 1, {
      attributes: { job: 'send', outcome: 'retrying' },
    });
  });

  it('counts a rate-limited request by route', () => {
    metrics.rateLimited('WebauthnSignupController#begin');

    expect(Sentry.metrics.count).toHaveBeenCalledWith('rate_limit.rejected', 1, {
      attributes: { route: 'WebauthnSignupController#begin' },
    });
  });

  it('adds generated operations, skipping a run that generated none', () => {
    metrics.operationsGenerated(12);
    metrics.operationsGenerated(0);

    expect(Sentry.metrics.count).toHaveBeenCalledTimes(1);
    expect(Sentry.metrics.count).toHaveBeenCalledWith('scheduler.operations_generated', 12);
  });
});
