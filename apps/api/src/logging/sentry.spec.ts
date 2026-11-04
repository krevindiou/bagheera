import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { vi } from 'vitest';
import { initSentry, scrubEvent } from './sentry';

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

  it('scrubs every event before it is sent', () => {
    process.env.SENTRY_DSN = 'https://key@example.invalid/1';

    initSentry();

    expect(vi.mocked(Sentry.init).mock.calls[0][0]?.beforeSend).toBe(scrubEvent);
  });
});

describe('scrubEvent', () => {
  const failedQuery =
    'Failed query: insert into "operation" ("id", "notes") values ($1, $2)\n' +
    'params: 0190a1a5-0000-7000-8000-000000000001,rent for flat 3B';
  const scrubbedQuery = 'Failed query: insert into "operation" ("id", "notes") values ($1, $2)';

  function pgError(message: string, code: string): Error {
    return Object.assign(new Error(message), { code });
  }

  function eventWith(...values: (string | undefined)[]): ErrorEvent {
    return {
      type: undefined,
      exception: {
        values: values.map((value) => ({
          type: 'Error',
          value,
          stacktrace: { frames: [{ filename: 'operation.service.ts', lineno: 44 }] },
        })),
      },
    };
  }

  it('cuts a failed query message at its parameters, keeping the SQL', () => {
    const event = scrubEvent(eventWith(failedQuery));

    expect(event.exception?.values?.[0]).toEqual({
      type: 'Error',
      value: scrubbedQuery,
      stacktrace: { frames: [{ filename: 'operation.service.ts', lineno: 44 }] },
    });
  });

  it('scrubs every value of a chained exception', () => {
    const event = scrubEvent(eventWith(failedQuery, `Wrapped: ${failedQuery}`));

    expect(event.exception?.values?.map((exception) => exception.value)).toEqual([
      scrubbedQuery,
      `Wrapped: ${scrubbedQuery}`,
    ]);
  });

  it('masks the input a Postgres data exception quotes', () => {
    const cause = pgError('invalid input syntax for type uuid: "rent "for" flat"', '22P02');
    const error = new Error(failedQuery, { cause });

    const event = scrubEvent(eventWith(cause.message, error.message), {
      originalException: error,
    });

    expect(event.exception?.values?.map((exception) => exception.value)).toEqual([
      'invalid input syntax for type uuid: "[Filtered]"',
      scrubbedQuery,
    ]);
  });

  it('masks an unterminated quoted input', () => {
    const cause = pgError('invalid input value for enum entry_type: "rent', '22P02');

    const event = scrubEvent(eventWith(cause.message), { originalException: cause });

    expect(event.exception?.values?.[0].value).toBe(
      'invalid input value for enum entry_type: "[Filtered]',
    );
  });

  it('keeps the identifiers other Postgres errors quote', () => {
    const cause = pgError(
      'duplicate key value violates unique constraint "member_email_key"',
      '23505',
    );

    const event = scrubEvent(eventWith(cause.message), { originalException: cause });

    expect(event.exception?.values?.[0].value).toBe(cause.message);
  });

  it('stops on a cyclic cause chain', () => {
    const error = pgError('value "9999999999" is out of range for type integer', '22003');
    error.cause = error;

    const event = scrubEvent(eventWith(error.message), { originalException: error });

    expect(event.exception?.values?.[0].value).toBe(
      'value "[Filtered]" is out of range for type integer',
    );
  });

  it('cuts the parameters from a captured message', () => {
    const event = scrubEvent({ type: undefined, message: failedQuery });

    expect(event.message).toBe(scrubbedQuery);
  });

  it('leaves other messages and exceptions untouched', () => {
    const event = eventWith('db down', undefined);
    event.message = 'scheduler run finished';
    const before = structuredClone(event);

    expect(scrubEvent(event)).toEqual(before);
  });

  it('keeps an event without an exception', () => {
    const event: ErrorEvent = { type: undefined, level: 'error' };

    expect(scrubEvent(event)).toEqual({ type: undefined, level: 'error' });
  });
});
