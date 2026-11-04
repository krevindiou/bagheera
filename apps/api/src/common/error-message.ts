import { DrizzleQueryError } from 'drizzle-orm/errors';

// Drizzle puts a failed query's bound values in its message and stack, and
// those are member content. Only the Postgres code is kept.
function queryFailureText(err: DrizzleQueryError): string {
  const { code } = (err.cause ?? {}) as { code?: unknown };
  return typeof code === 'string' ? `query failed (${code})` : 'query failed';
}

/** A thrown value's message, for logs: `throw` accepts non-Errors too. */
export function errorMessage(err: unknown): string {
  if (err instanceof DrizzleQueryError) {
    return queryFailureText(err);
  }
  return err instanceof Error ? err.message : String(err);
}

/** An Error's stack, for logs, without a failed query's bound values. */
export function errorStack(err: Error): string | undefined {
  if (!(err instanceof DrizzleQueryError)) {
    return err.stack;
  }
  const text = queryFailureText(err);
  // A function replacer: the text is not a pattern with `$` expansions.
  return err.stack?.replace(err.message, () => text) ?? text;
}

/**
 * The error to hand to a queue: BullMQ keeps its message and stack in Valkey
 * as the job's failure. The cause is kept for `isUniqueViolation`; the
 * query's text and values are not.
 */
export function withoutQueryValues<T>(err: T): T | Error {
  if (!(err instanceof DrizzleQueryError)) {
    return err;
  }
  const safe = new Error(queryFailureText(err), { cause: err.cause });
  safe.stack = errorStack(err);
  return safe;
}
