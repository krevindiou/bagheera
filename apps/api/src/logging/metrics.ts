import type { SecurityEventType } from '../security/audit.service';
import { Sentry } from './sentry';

/**
 * Custom Sentry metrics, no-ops without SENTRY_DSN. Attributes stay
 * low-cardinality and never identify a member: no ids, addresses or emails.
 */
export const metrics = {
  securityEvent: (event: SecurityEventType): void => {
    Sentry.metrics.count('security.event', 1, { attributes: { event } });
  },

  // `retrying` for an attempt BullMQ will run again, `failed` for the last.
  emailJob: (job: string, outcome: 'sent' | 'retrying' | 'failed'): void => {
    Sentry.metrics.count('email.job', 1, { attributes: { job, outcome } });
  },

  rateLimited: (route: string): void => {
    Sentry.metrics.count('rate_limit.rejected', 1, { attributes: { route } });
  },

  operationsGenerated: (count: number): void => {
    if (count > 0) {
      Sentry.metrics.count('scheduler.operations_generated', count);
    }
  },
};
