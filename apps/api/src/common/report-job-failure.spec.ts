import type { Job } from 'bullmq';
import { Sentry } from '../logging/sentry';
import { reportFinalJobFailure } from './report-job-failure';

jest.mock('../logging/sentry', () => ({ Sentry: { captureException: jest.fn() } }));

function job(attemptsMade: number, attempts?: number): Job {
  return { id: '9', name: 'send', queueName: 'email', attemptsMade, opts: { attempts } } as Job;
}

describe('reportFinalJobFailure', () => {
  const err = new Error('SMTP down');

  beforeEach(() => jest.clearAllMocks());

  it('stays quiet while retries remain', () => {
    reportFinalJobFailure(job(1, 3), err);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports the failure once the last attempt is used up', () => {
    reportFinalJobFailure(job(3, 3), err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { queue: 'email', jobId: '9', jobName: 'send' },
    });
  });

  it('treats a job without an attempts setting as a single attempt', () => {
    reportFinalJobFailure(job(1), err);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('ignores a failure with no job attached', () => {
    reportFinalJobFailure(undefined, err);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
