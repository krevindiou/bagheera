import { vi } from 'vitest';

/**
 * Runs `fn` with `Date.now()` pushed `ms` into the future, then restores it.
 * Only `Date.now()` moves (not timers), which is all the session-timestamp
 * checks under test read — and it keeps the HTTP stack's own timeouts real.
 * Resolve anything that itself needs a request (CSRF tokens, ...) before
 * calling this, so only the one request under test sees the shifted clock.
 */
export async function withClockAhead<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const realNow = Date.now.bind(Date);
  const spy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ms);
  try {
    return await fn();
  } finally {
    spy.mockRestore();
  }
}
