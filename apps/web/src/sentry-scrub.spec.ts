import type { ErrorEvent, Log } from '@sentry/vue';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent, scrubKeyParam, scrubLog } from './sentry-scrub';

describe('scrubKeyParam', () => {
  it.each([
    ['https://app.test/en/activate?key=abc.def', 'https://app.test/en/activate?key=[Filtered]'],
    ['/en/activate?a=1&key=abc&b=2', '/en/activate?a=1&key=[Filtered]&b=2'],
    ['/en/activate?key=abc#top', '/en/activate?key=[Filtered]#top'],
    ['/en/accounts?monkey=1', '/en/accounts?monkey=1'],
    ['/en/accounts', '/en/accounts'],
  ])('%s', (input, expected) => {
    expect(scrubKeyParam(input)).toBe(expected);
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs navigation and request URLs', () => {
    const crumb = scrubBreadcrumb({
      category: 'navigation',
      data: { from: '/en/activate?key=s3cret', to: '/en/home', url: '/x?key=s3cret' },
    });
    expect(crumb.data).toEqual({
      from: '/en/activate?key=[Filtered]',
      to: '/en/home',
      url: '/x?key=[Filtered]',
    });
  });

  it('copes with a breadcrumb without data', () => {
    expect(scrubBreadcrumb({ message: 'hi' })).toEqual({ message: 'hi' });
  });
});

describe('scrubEvent', () => {
  it('scrubs the page URL, query string, referrer and breadcrumbs', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://app.test/en/confirm-email-change?key=s3cret',
        query_string: 'key=s3cret&x=1',
        headers: { Referer: 'https://app.test/en/activate?key=s3cret' },
      },
      breadcrumbs: [{ category: 'navigation', data: { to: '/en/activate?key=s3cret' } }],
    });

    expect(JSON.stringify(event)).not.toContain('s3cret');
    expect(event.request?.query_string).toBe('key=[Filtered]&x=1');
  });

  it('passes an event with no request or breadcrumbs through', () => {
    const event = { type: undefined, message: 'boom' } as ErrorEvent;
    expect(scrubEvent(event)).toBe(event);
  });
});

describe('scrubLog', () => {
  it('scrubs the message and string attributes', () => {
    const log = scrubLog({
      level: 'warn',
      message: 'Failed to load /en/activate?key=s3cret',
      attributes: { 'sentry.message.parameter.0': '/en/activate?key=s3cret', count: 2 },
    });

    expect(log).toEqual({
      level: 'warn',
      message: 'Failed to load /en/activate?key=[Filtered]',
      attributes: { 'sentry.message.parameter.0': '/en/activate?key=[Filtered]', count: 2 },
    });
  });

  it('leaves a parameterized message to its scrubbed parameters', () => {
    const message = Object.assign(new String('Failed to load %s'), {
      __sentry_template_string__: 'Failed to load %s',
    }) as unknown as Log['message'];

    expect(scrubLog({ level: 'warn', message }).message).toBe(message);
  });

  it('passes a log without attributes through', () => {
    expect(scrubLog({ level: 'error', message: 'boom' })).toEqual({
      level: 'error',
      message: 'boom',
    });
  });
});
