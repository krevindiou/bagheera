import { DrizzleQueryError } from 'drizzle-orm/errors';
import { isUniqueViolation } from '../db/pg-errors';
import { errorMessage, errorStack, withoutQueryValues } from './error-message';

const MARKER = 'marker-third-party';

function failedQuery(code?: string): DrizzleQueryError {
  const cause = code === undefined ? new Error('boom') : Object.assign(new Error('boom'), { code });
  return new DrizzleQueryError(
    'insert into "operation" ("third_party") values ($1)',
    [MARKER],
    cause,
  );
}

describe('errorMessage', () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error('connection refused'))).toBe('connection refused');
  });

  it('stringifies a thrown non-Error', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('reduces a failed query to its Postgres code', () => {
    expect(errorMessage(failedQuery('23505'))).toBe('query failed (23505)');
  });

  it('reduces a failed query without a Postgres code to a bare notice', () => {
    expect(errorMessage(failedQuery())).toBe('query failed');
    expect(errorMessage(new DrizzleQueryError('select 1', [], undefined))).toBe('query failed');
  });
});

describe('errorStack', () => {
  it("returns an ordinary Error's stack as is", () => {
    const err = new Error('boom');

    expect(errorStack(err)).toBe(err.stack);
  });

  it('swaps a failed query message for its code, keeping the frames', () => {
    const err = failedQuery('23505');
    expect(err.stack).toContain(MARKER);

    const stack = errorStack(err);

    expect(stack).not.toContain(MARKER);
    expect(stack).toMatch(/^Error: query failed \(23505\)\n\s+at /);
  });

  it('falls back to the notice when the stack is missing', () => {
    const err = failedQuery('23505');
    err.stack = undefined;

    expect(errorStack(err)).toBe('query failed (23505)');
  });
});

describe('withoutQueryValues', () => {
  it('returns anything but a failed query as is', () => {
    const err = new Error('SMTP down');

    expect(withoutQueryValues(err)).toBe(err);
    expect(withoutQueryValues('text')).toBe('text');
  });

  it('replaces a failed query by an error without its values, keeping the cause', () => {
    const err = failedQuery('23505');

    const safe = withoutQueryValues(err);

    expect(safe).not.toBe(err);
    expect(safe).not.toBeInstanceOf(DrizzleQueryError);
    expect(safe.message).toBe('query failed (23505)');
    expect(safe.stack).not.toContain(MARKER);
    expect(JSON.stringify(safe)).not.toContain(MARKER);
    expect(isUniqueViolation(safe)).toBe(true);
  });
});
