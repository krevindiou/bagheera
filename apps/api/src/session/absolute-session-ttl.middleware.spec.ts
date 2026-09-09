import type { Response } from 'express';
import { absoluteSessionTtl } from './absolute-session-ttl.middleware';
import { SESSION_MAX_AGE_MS } from './session.constants';
import { fakeRequest, fakeResponse } from '../test-support/fake-http-context';

// absoluteSessionTtl takes a real Express Response — this middleware never
// reads anything off it, but the signature still needs satisfying.
// fakeResponse() is deliberately typed as its own FakeResponse shape, not
// Response itself (see fake-http-context.ts), so the cast lives here, at
// the one place calling production code directly instead of through
// fakeArgumentsHost/fakeExecutionContext (which already accept the loose
// shape).
function res(): Response {
  return fakeResponse() as unknown as Response;
}

describe('absoluteSessionTtl', () => {
  it('calls next() untouched when the request has no session', () => {
    const next = jest.fn();
    absoluteSessionTtl(
      fakeRequest({ session: undefined as never }),
      res(),
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('stamps createdAt on first touch and calls next()', () => {
    const req = fakeRequest({ session: {} as never });
    const next = jest.fn();
    const before = Date.now();
    absoluteSessionTtl(req, res(), next);
    expect(req.session.createdAt).toBeGreaterThanOrEqual(before);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() without touching the session when still within the TTL', () => {
    const req = fakeRequest({
      session: { createdAt: Date.now() - 1000 } as never,
    });
    const destroy = jest.fn();
    (req.session as unknown as { destroy: typeof destroy }).destroy = destroy;
    const next = jest.fn();
    absoluteSessionTtl(req, res(), next);
    expect(destroy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('destroys the session and calls next() once the absolute TTL has passed', () => {
    const createdAt = Date.now() - SESSION_MAX_AGE_MS - 1000;
    const next = jest.fn();
    const destroy = jest.fn((cb: () => void) => cb());
    const req = fakeRequest({ session: { createdAt, destroy } as never });
    absoluteSessionTtl(req, res(), next);
    expect(destroy).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
