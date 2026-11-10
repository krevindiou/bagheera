import type { Request } from 'express';
import { vi } from 'vitest';
import { recordSessionClient } from './record-session-client';

function fakeRequest(userAgent: string | undefined): Request {
  return {
    ip: '203.0.113.7',
    session: {},
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? userAgent : undefined),
  } as unknown as Request;
}

describe('recordSessionClient', () => {
  it('records the user agent, source address and sign-in time on the session', () => {
    vi.useFakeTimers({ now: 1_000 });
    try {
      const req = fakeRequest('Firefox/132.0');
      recordSessionClient(req);
      expect(req.session.client).toEqual({
        userAgent: 'Firefox/132.0',
        ip: '203.0.113.7',
        signedInAt: 1_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps a long user agent and records a missing one as null', () => {
    const long = fakeRequest('x'.repeat(2000));
    recordSessionClient(long);
    expect(long.session.client?.userAgent).toHaveLength(512);

    const none = fakeRequest(undefined);
    recordSessionClient(none);
    expect(none.session.client?.userAgent).toBeNull();
  });
});
