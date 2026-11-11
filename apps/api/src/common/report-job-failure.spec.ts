import type { Job } from 'bullmq';
import { Sentry } from '../logging/sentry';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { isFinalAttempt, reportFinalJobFailure, withSafeJobErrors } from './report-job-failure';
import { vi } from 'vitest';

vi.mock('../logging/sentry', () => ({ Sentry: { captureException: vi.fn() } }));

function job(attemptsMade: number, attempts?: number): Job {
  return { id: '9', name: 'send', queueName: 'email', attemptsMade, opts: { attempts } } as Job;
}

describe('isFinalAttempt', () => {
  it.each([
    [1, 3, false],
    [3, 3, true],
    [1, undefined, true],
  ])('%i of %s attempts made: %s', (attemptsMade, attempts, expected) => {
    expect(isFinalAttempt(job(attemptsMade, attempts))).toBe(expected);
  });
});

describe('reportFinalJobFailure', () => {
  const err = new Error('SMTP down');

  beforeEach(() => vi.clearAllMocks());

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

describe('reportFinalJobFailure with a failed query', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports it without the bound values', () => {
    const failed = new DrizzleQueryError('insert into "member" ("email") values ($1)', ['a@b.c'], {
      name: 'error',
      message: 'duplicate key',
      code: '23505',
    } as Error);

    reportFinalJobFailure(job(3, 3), failed);

    const [[reported]] = vi.mocked(Sentry.captureException).mock.calls as [[Error]];
    expect(reported.message).toBe('query failed (23505)');
    expect(reported.stack).not.toContain('a@b.c');
  });
});

describe('withSafeJobErrors', () => {
  it('returns what the job returns', async () => {
    await expect(withSafeJobErrors(() => Promise.resolve(7))).resolves.toBe(7);
  });

  it('rethrows an ordinary error untouched', async () => {
    const err = new Error('SMTP down');

    await expect(withSafeJobErrors(() => Promise.reject(err))).rejects.toBe(err);
  });

  it('rethrows a failed query without its bound values, keeping the cause', async () => {
    const cause = Object.assign(new Error('duplicate key'), { code: '23505' });
    const failed = new DrizzleQueryError(
      'insert into "member" ("email") values ($1)',
      ['a@b.c'],
      cause,
    );

    const thrown = await withSafeJobErrors(() => Promise.reject(failed)).catch((e: Error) => e);

    expect(thrown).toMatchObject({ message: 'query failed (23505)', cause });
    expect(thrown.stack).not.toContain('a@b.c');
  });
});
