import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint } from '@sentry/node';

// Drizzle appends a failed query's bound values after this; the SQL before it
// is parametrised and carries none.
const QUERY_PARAMS_MARKER = '\nparams: ';

const FILTERED = '[Filtered]';

function withoutQueryParams(text: string): string {
  const at = text.indexOf(QUERY_PARAMS_MARKER);
  return at === -1 ? text : text.slice(0, at);
}

// Postgres quotes the rejected input without escaping inner quotes, so
// everything between the first and last quote is masked.
function withoutQuotedInput(text: string): string {
  const open = text.indexOf('"');
  if (open === -1) {
    return text;
  }
  const close = text.lastIndexOf('"');
  return text.slice(0, open + 1) + FILTERED + (close > open ? text.slice(close) : '');
}

// SQLSTATE class 22 (data exception) messages quote the offending value,
// e.g. `invalid input syntax for type uuid: "..."`. Other classes keep values
// in `detail`, which never reaches the event.
function dataExceptionMessages(error: unknown): Set<string> {
  const messages = new Set<string>();
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    const { code } = current as { code?: unknown };
    if (typeof code === 'string' && code.startsWith('22')) {
      messages.add(current.message);
    }
    current = current.cause;
  }
  return messages;
}

/**
 * Query values are member content (notes, labels, emails, amounts), so they
 * are cut from every exception value, linked causes included. The event
 * itself is always kept, so the error type and stack still get reported.
 */
export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  const dataExceptions = dataExceptionMessages(hint?.originalException);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value === undefined) {
      continue;
    }
    exception.value = dataExceptions.has(exception.value)
      ? withoutQuotedInput(exception.value)
      : withoutQueryParams(exception.value);
  }
  if (event.message !== undefined) {
    event.message = withoutQueryParams(event.message);
  }
  return event;
}

/**
 * No-op without SENTRY_DSN. Called in main.ts before AppModule is
 * imported, so instrumentation is in place first.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
    // Request bodies carry one-time keys, notes and bank statement text.
    dataCollection: { httpBodies: [] },
    beforeSend: scrubEvent,
  });
}

export { Sentry };
