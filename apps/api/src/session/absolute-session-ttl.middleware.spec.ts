import { absoluteSessionTtl } from './absolute-session-ttl.middleware';
import { SESSION_MAX_AGE_MS } from './session.constants';
import { fakeRequest, fakeResponse } from '../test-support/fake-http-context';

describe('absoluteSessionTtl', () => {
  it('calls next() untouched when the request has no session', () => {
    const next = jest.fn();
    absoluteSessionTtl(
      fakeRequest({ session: undefined as never }),
      fakeResponse(),
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('stamps createdAt on first touch and calls next()', () => {
    const req = fakeRequest({ session: {} as never });
    const next = jest.fn();
    const before = Date.now();
    absoluteSessionTtl(req, fakeResponse(), next);
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
    absoluteSessionTtl(req, fakeResponse(), next);
    expect(destroy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('destroys the session and calls next() once the absolute TTL has passed', () => {
    const createdAt = Date.now() - SESSION_MAX_AGE_MS - 1000;
    const next = jest.fn();
    const destroy = jest.fn((cb: () => void) => cb());
    const req = fakeRequest({ session: { createdAt, destroy } as never });
    absoluteSessionTtl(req, fakeResponse(), next);
    expect(destroy).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
