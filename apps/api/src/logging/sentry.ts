import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint, Log, NodeOptions } from '@sentry/node';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { errorMessage } from '../common/error-message';

// Drizzle appends a failed query's bound values after this; the SQL before it
// is parametrised and carries none.
const QUERY_PARAMS_MARKER = '\nparams: ';
const FAILED_QUERY_PREFIX = 'Failed query:';

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

// Sentry reports a Drizzle query error as a plain `Error`, so its exception
// value is matched by the message it carried: through the error object when
// there is one, by prefix otherwise.
function failedQueryTexts(error: unknown): Map<string, string> {
  const texts = new Map<string, string>();
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (current instanceof DrizzleQueryError) {
      texts.set(current.message, errorMessage(current));
    }
    current = current.cause;
  }
  return texts;
}

/**
 * Query values are member content (notes, labels, emails, amounts), so they
 * are cut from every exception value, linked causes included; a failed
 * query's value is reduced to its Postgres code. The event
 * itself is always kept, so the error type and stack still get reported.
 */
export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  const dataExceptions = dataExceptionMessages(hint?.originalException);
  const failedQueries = failedQueryTexts(hint?.originalException);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value === undefined) {
      continue;
    }
    const failedQuery =
      failedQueries.get(exception.value) ??
      (exception.value.startsWith(FAILED_QUERY_PREFIX) ? 'query failed' : undefined);
    if (failedQuery !== undefined) {
      exception.value = failedQuery;
    } else {
      exception.value = dataExceptions.has(exception.value)
        ? withoutQuotedInput(exception.value)
        : withoutQueryParams(exception.value);
    }
  }
  if (event.message !== undefined) {
    event.message = withoutQueryParams(event.message);
  }
  return event;
}

type StreamedSpan = Parameters<NonNullable<NodeOptions['beforeSendSpan']>>[0];

/**
 * Redis spans record a command's arguments: session ids, rate-limit keys,
 * and for BullMQ's scripts the queued job itself (an email with its one-time
 * link). Only the command name is kept.
 */
export function scrubSpan(span: StreamedSpan): StreamedSpan {
  const { attributes } = span;
  if (attributes['db.system.name'] === 'redis' && 'db.query.text' in attributes) {
    attributes['db.query.text'] = attributes['db.operation.name'];
  }
  return span;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Pino lines become Sentry logs. pino-http's request URL and query can carry
 * typed search text, so only the path is kept; its headers and remote
 * address, the client's address, are dropped; a failed query's values are
 * cut as in events.
 */
export function scrubLog(log: Log): Log {
  if (typeof log.message === 'string') {
    log.message = withoutQueryParams(log.message);
  }
  const req = log.attributes?.req;
  if (isRecord(req)) {
    delete req.query;
    delete req.headers;
    delete req.remoteAddress;
    delete req.remotePort;
    if (typeof req.url === 'string') {
      req.url = req.url.replace(/[?#].*$/s, '');
    }
  }
  return log;
}

// Every request is traced: traffic is low enough to stay within quota.
const TRACES_SAMPLE_RATE = 1;

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
    tracesSampleRate: TRACES_SAMPLE_RATE,
    // Polled every few seconds by the container healthchecks.
    ignoreSpans: [{ attributes: { 'url.path': /^\/health$/ } }],
    dataCollection: {
      // Request bodies carry one-time keys, notes and bank statement text;
      // query strings, typed search text; queued jobs, emails and their links;
      // a failing frame's locals, decrypted member data. A client's address
      // is personal data every request would otherwise carry.
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      userInfo: false,
      httpHeaders: { request: { deny: ['forwarded', 'x-real-ip'] } },
    },
    integrations: [Sentry.pinoIntegration(), Sentry.nodeRuntimeMetricsIntegration()],
    beforeSend: scrubEvent,
    beforeSendSpan: scrubSpan,
    beforeSendLog: scrubLog,
  });
}

export { Sentry };
