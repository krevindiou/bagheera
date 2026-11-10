import type { Response } from 'express';
import { absoluteSessionTtl } from './absolute-session-ttl.middleware';
import { ANONYMOUS_SESSION_MAX_AGE_MS, SESSION_MAX_AGE_MS } from './session.constants';
import { fakeRequest, fakeResponse } from '../test-support/fake-http-context';
import { vi } from 'vitest';

// Never read by the middleware; only the signature needs a Response.
function res(): Response {
  return fakeResponse() as unknown as Response;
}

describe('absoluteSessionTtl', () => {
  it('calls next() untouched when the request has no session', () => {
    const next = vi.fn();
    absoluteSessionTtl(fakeRequest({ session: undefined as never }), res(), next);
    expect(next).toHaveBeenCalledWith();
  });

  // Stamping it would mark it modified, and express-session would then
  // store it and send a cookie for every anonymous request.
  it('leaves a session generated for this request unstamped and calls next()', () => {
    const req = fakeRequest({ session: { cookie: {} } as never });
    const next = vi.fn();
    absoluteSessionTtl(req, res(), next);
    expect(req.session.createdAt).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('stamps createdAt the first time a stored session comes back and calls next()', () => {
    const req = fakeRequest({ session: { cookie: {}, csrfIssued: true } as never });
    const next = vi.fn();
    const before = Date.now();
    absoluteSessionTtl(req, res(), next);
    expect(req.session.createdAt).toBeGreaterThanOrEqual(before);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() without touching a signed-in session still within its 8h cap', () => {
    const regenerate = vi.fn();
    const req = fakeRequest({
      session: {
        memberId: 'm',
        createdAt: Date.now() - 2 * ANONYMOUS_SESSION_MAX_AGE_MS,
        regenerate,
      } as never,
    });
    const next = vi.fn();
    absoluteSessionTtl(req, res(), next);
    expect(regenerate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() without touching an anonymous session still within its cap', () => {
    const regenerate = vi.fn();
    const req = fakeRequest({
      session: { csrfIssued: true, createdAt: Date.now() - 1000, regenerate } as never,
    });
    const next = vi.fn();
    absoluteSessionTtl(req, res(), next);
    expect(regenerate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  // A fresh session, not none: CSRF checks and the token mint read req.session.
  it.each([
    ['a signed-in session past 8h', { memberId: 'm', createdAt: -SESSION_MAX_AGE_MS - 1000 }],
    [
      'an anonymous session past its cap',
      { csrfIssued: true, createdAt: -ANONYMOUS_SESSION_MAX_AGE_MS - 1000 },
    ],
  ])('swaps %s for a fresh one and calls next()', (_label, { createdAt, ...fields }) => {
    const next = vi.fn();
    const regenerate = vi.fn((cb: () => void) => cb());
    const req = fakeRequest({
      session: { ...fields, createdAt: Date.now() + createdAt, regenerate } as never,
    });
    absoluteSessionTtl(req, res(), next);
    expect(regenerate).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
