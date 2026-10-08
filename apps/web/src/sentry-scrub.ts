import type { Breadcrumb, ErrorEvent } from '@sentry/vue';

/**
 * Emailed links carry a one-time token in `?key=`. The pages drop it from
 * the address bar (takeUrlKey.ts), but an earlier error, breadcrumb or
 * referrer can still hold it.
 */
export function scrubKeyParam(value: string): string {
  return value.replace(/([?&])key=[^&#]*/g, '$1key=[Filtered]');
}

function scrubData(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  for (const field of ['url', 'from', 'to']) {
    const value = data[field];
    if (typeof value === 'string') {
      data[field] = scrubKeyParam(value);
    }
  }
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  scrubData(breadcrumb.data);
  return breadcrumb;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { request } = event;
  if (request) {
    if (request.url) request.url = scrubKeyParam(request.url);
    if (typeof request.query_string === 'string') {
      request.query_string = scrubKeyParam(`?${request.query_string}`).slice(1);
    }
    if (request.headers?.Referer) {
      request.headers.Referer = scrubKeyParam(request.headers.Referer);
    }
  }
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  return event;
}
